
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api, isDemoMode } from '../api/client';
import type { AppData } from '../types';
import { normalizeAppDataCompatibility } from '../utils/tournament/compatibility';

type SetState<T> = React.Dispatch<React.SetStateAction<T | 'error' | null>>;

export function useAppState<T extends AppData>(
    userId: string | null,
    getInitialData: () => T,
    enabled: boolean = true
): [T | 'error' | null, SetState<T>, boolean, Error | null] {
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

    const saveToServer = useCallback(async (data: T) => {
        if (!userId || !enabled) return;

        const finalData = compactData(data);
        const currentJson = JSON.stringify(finalData);

        try {
            localStorage.setItem(`backup_data_${userId}`, currentJson);
            localStorage.setItem(`backup_timestamp_${userId}`, Date.now().toString());
        } catch (e) {
            console.warn('Local backup failed:', e);
        }

        if (currentJson === lastSavedJson.current) {
            setIsSaving(false);
            isDirty.current = false;
            return;
        }

        try {
            isPendingWrite.current = true;
            setIsSaving(true);
            setSaveError(null);

            if (isDemoMode) {
                localStorage.setItem(`demo_data_${userId}`, currentJson);
                await new Promise((resolve) => setTimeout(resolve, 300));
            } else {
                const result = await api.saveAppData(finalData as unknown as Record<string, unknown>);
                lastServerUpdatedAt.current = result.lastUpdatedAt;
            }

            lastSavedJson.current = currentJson;
            isDirty.current = false;
            localTruthRef.current = finalData;
            setState(finalData);
        } catch (e: unknown) {
            console.error('[API Error] Save failed:', e);
            setSaveError(e instanceof Error ? e : new Error('Save failed'));
            alert('⚠️ 데이터 저장에 실패했습니다! 인터넷 연결을 확인해주세요.');
        } finally {
            isPendingWrite.current = false;
            setIsSaving(false);
        }
    }, [userId, enabled]);

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isDirty.current || isPendingWrite.current) {
                if (localTruthRef.current) {
                    saveToServer(localTruthRef.current);
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

            const compactedNext = compactData(nextState);
            localTruthRef.current = compactedNext;
            isDirty.current = true;
            setIsSaving(true);

            if (writeTimeout.current) window.clearTimeout(writeTimeout.current);
            writeTimeout.current = window.setTimeout(() => {
                const latest = localTruthRef.current;
                if (latest) saveToServer(latest);
                writeTimeout.current = null;
            }, 1000);

            return compactedNext;
        });
    }, [saveToServer]);

    return [state, setDebouncedState, isSaving, saveError];
}
