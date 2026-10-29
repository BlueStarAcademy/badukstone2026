
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api, isDemoMode } from '../api/client';
import type { AppData } from '../types';
import { normalizeAppDataCompatibility } from '../utils/tournament/compatibility';

type SetState<T> = React.Dispatch<React.SetStateAction<T | 'error' | null>>;

export function useAppState<T extends AppData>(
    userId: string | null,
    getInitialData: () => T,
    enabled: boolean = true
): [T | 'error' | null, SetState<T>, boolean, Error | null, () => void] {
    const [state, setState] = useState<T | 'error' | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<Error | null>(null);

    const localTruthRef = useRef<T | null>(null);
    const isPendingWrite = useRef<boolean>(false);
    const isDirty = useRef<boolean>(false);
    const writeTimeout = useRef<number | null>(null);
    const lastSavedJson = useRef<string>('');
    const lastServerUpdatedAt = useRef<number>(0);

    const mergeData = useCallback((incoming: unknown): T => {
        const initial = getInitialData();
        return normalizeAppDataCompatibility(incoming, initial);
    }, [getInitialData]);

    const compactData = (data: T): T => {
        const MAX_TX = 800;
        const MAX_CHESS = 400;
        const KEEP_MONTHS = 2;

        const compact = { ...data };

        if (Array.isArray(compact.transactions) && compact.transactions.length > MAX_TX) {
            const cutoff = new Date();
            cutoff.setMonth(cutoff.getMonth() - KEEP_MONTHS);
            const cutoffTime = cutoff.getTime();
            const recent: typeof compact.transactions = [];
            const older: typeof compact.transactions = [];
            for (const t of compact.transactions) {
                const ts = new Date((t as { timestamp?: string }).timestamp || 0).getTime();
                if (ts >= cutoffTime) recent.push(t);
                else older.push(t);
            }
            const keepFromOlder = Math.max(0, MAX_TX - recent.length);
            compact.transactions = [...recent, ...older.slice(0, keepFromOlder)];
        }

        if (Array.isArray(compact.chessMatches) && compact.chessMatches.length > MAX_CHESS) {
            const cutoff = new Date();
            cutoff.setMonth(cutoff.getMonth() - KEEP_MONTHS);
            const cutoffTime = cutoff.getTime();
            const recent: typeof compact.chessMatches = [];
            const older: typeof compact.chessMatches = [];
            for (const m of compact.chessMatches) {
                const ts = new Date((m as { timestamp?: string }).timestamp || 0).getTime();
                if (ts >= cutoffTime) recent.push(m);
                else older.push(m);
            }
            const keepFromOlder = Math.max(0, MAX_CHESS - recent.length);
            compact.chessMatches = [...recent, ...older.slice(0, keepFromOlder)];
        }

        return compact;
    };

    const hasPendingLocalEdits = useCallback(() => {
        return isDirty.current || isPendingWrite.current || writeTimeout.current !== null;
    }, []);

    const saveToServerRef = useRef<(data: T) => Promise<void>>(async () => {});

    const scheduleSave = useCallback((delayMs: number) => {
        if (writeTimeout.current) window.clearTimeout(writeTimeout.current);
        writeTimeout.current = window.setTimeout(() => {
            writeTimeout.current = null;
            const latest = localTruthRef.current;
            if (latest) void saveToServerRef.current(latest);
        }, delayMs);
    }, []);

    const saveToServer = useCallback(async (_data: T) => {
        if (!userId || !enabled) return;

        // 저장 중이면 최신 로컬 상태만 dirty로 표시하고, 진행 중인 저장이 이어서 처리
        if (isPendingWrite.current) {
            isDirty.current = true;
            return;
        }

        isPendingWrite.current = true;
        setIsSaving(true);

        const MAX_ATTEMPTS = 3;
        const RETRY_DELAYS_MS = [600, 1500, 3000];

        try {
            // 저장 중에 추가 편집이 들어오면 같은 루프에서 최신본을 이어서 저장
            while (true) {
                const latest = localTruthRef.current;
                if (!latest) {
                    isDirty.current = false;
                    break;
                }

                const finalData = compactData(latest);
                const currentJson = JSON.stringify(finalData);

                try {
                    localStorage.setItem(`backup_data_${userId}`, currentJson);
                    localStorage.setItem(`backup_timestamp_${userId}`, Date.now().toString());
                } catch (e) {
                    console.warn('Local backup failed:', e);
                }

                if (currentJson === lastSavedJson.current) {
                    isDirty.current = false;
                    setSaveError(null);
                    break;
                }

                let saved = false;
                let lastError: unknown = null;

                for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
                    // 재시도 전에 더 최신 편집이 있으면 그 스냅샷으로 전환
                    const attemptData = localTruthRef.current;
                    if (!attemptData) break;
                    const attemptCompacted = compactData(attemptData);
                    const attemptJson = JSON.stringify(attemptCompacted);

                    if (attemptJson === lastSavedJson.current) {
                        saved = true;
                        isDirty.current = false;
                        setSaveError(null);
                        break;
                    }

                    try {
                        if (isDemoMode) {
                            localStorage.setItem(`demo_data_${userId}`, attemptJson);
                            await new Promise((resolve) => setTimeout(resolve, 300));
                        } else {
                            const result = await api.saveAppData(
                                attemptCompacted as unknown as Record<string, unknown>
                            );
                            lastServerUpdatedAt.current = result.lastUpdatedAt;
                        }

                        lastSavedJson.current = attemptJson;
                        saved = true;
                        setSaveError(null);
                        break;
                    } catch (e: unknown) {
                        lastError = e;
                        console.error(`[API Error] Save failed (attempt ${attempt + 1}/${MAX_ATTEMPTS}):`, e);
                        if (attempt < MAX_ATTEMPTS - 1) {
                            await new Promise((resolve) =>
                                setTimeout(resolve, RETRY_DELAYS_MS[attempt] ?? 3000)
                            );
                        }
                    }
                }

                if (!saved) {
                    isDirty.current = true;
                    setSaveError(lastError instanceof Error ? lastError : new Error('Save failed'));
                    // 일시적 오류일 수 있으므로 자동 재시도 예약 (알림창은 띄우지 않음 — 배너로 표시)
                    scheduleSave(5000);
                    break;
                }

                const afterJson = localTruthRef.current
                    ? JSON.stringify(compactData(localTruthRef.current))
                    : lastSavedJson.current;

                if (afterJson === lastSavedJson.current) {
                    isDirty.current = false;
                    break;
                }

                isDirty.current = true;
                // 루프를 계속해 최신본을 바로 이어서 저장
            }
        } finally {
            isPendingWrite.current = false;
            setIsSaving(false);
        }
    }, [userId, enabled, scheduleSave]);

    saveToServerRef.current = saveToServer;

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isDirty.current || isPendingWrite.current || writeTimeout.current !== null) {
                if (localTruthRef.current && !isPendingWrite.current) {
                    void saveToServer(localTruthRef.current);
                }
                e.preventDefault();
                e.returnValue = '저장되지 않은 데이터가 있습니다. 정말 나가시겠습니까?';
                return '저장되지 않은 데이터가 있습니다. 정말 나가시겠습니까?';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [saveToServer]);

    const reloadFromServer = useCallback(async () => {
        if (!userId || !enabled) return;
        if (hasPendingLocalEdits()) return;
        try {
            const result = await api.getAppData();
            if (!result.data) return;
            const serverData = mergeData(result.data);
            const serverJson = JSON.stringify(serverData);
            if (JSON.stringify(localTruthRef.current) !== serverJson) {
                localTruthRef.current = serverData;
                lastSavedJson.current = serverJson;
                lastServerUpdatedAt.current = result.lastUpdatedAt;
                setState(serverData);
            }
        } catch (err) {
            console.error('[API Error] Reload failed:', err);
        }
    }, [userId, enabled, mergeData, hasPendingLocalEdits]);

    useEffect(() => {
        if (!userId || !enabled) return;

        const loadInitial = async () => {
            if (isDemoMode) {
                const saved = localStorage.getItem(`demo_data_${userId}`);
                const data = saved ? mergeData(JSON.parse(saved)) : getInitialData();
                localTruthRef.current = data;
                setState(data);
                return;
            }

            try {
                const result = await api.getAppData();
                let initialData: T;
                if (result.data) {
                    initialData = mergeData(result.data);
                } else {
                    initialData = getInitialData();
                    await api.saveAppData(initialData as unknown as Record<string, unknown>);
                }
                localTruthRef.current = initialData;
                lastSavedJson.current = JSON.stringify(initialData);
                lastServerUpdatedAt.current = result.lastUpdatedAt;
                setState(initialData);
            } catch (err) {
                console.error('[API Error] Load failed:', err);
                setState('error');
            }
        };

        loadInitial();

        if (!isDemoMode) {
            const unsubscribe = api.subscribeAppData((lastUpdatedAt) => {
                if (hasPendingLocalEdits()) return;
                if (lastUpdatedAt <= lastServerUpdatedAt.current) return;
                reloadFromServer();
            });
            return unsubscribe;
        }
    }, [userId, enabled, mergeData, getInitialData, reloadFromServer, hasPendingLocalEdits]);

    const setDebouncedState: SetState<T> = useCallback((newStateOrFn) => {
        setState((prevState) => {
            if (prevState === 'error' || prevState === null) return prevState;

            const nextState = typeof newStateOrFn === 'function'
                ? (newStateOrFn as (prev: T | 'error' | null) => T)(prevState)
                : newStateOrFn;

            if (!nextState || nextState === 'error') return nextState;

            localTruthRef.current = nextState;
            isDirty.current = true;
            scheduleSave(400);

            return nextState;
        });
    }, [scheduleSave]);

    const retrySave = useCallback(() => {
        if (!localTruthRef.current) return;
        isDirty.current = true;
        scheduleSave(0);
    }, [scheduleSave]);

    return [state, setDebouncedState, isSaving, saveError, retrySave];
}
