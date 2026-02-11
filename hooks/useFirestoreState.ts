
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { doc, setDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { db, isDemoMode } from '../firebase';
import type { AppData } from '../types';

type SetState<T> = React.Dispatch<React.SetStateAction<T | 'error' | null>>;

// 반환 타입에 에러 상태 추가
export function useFirestoreState<T extends AppData>(
    userId: string | null,
    getInitialData: () => T
): [T | 'error' | null, SetState<T>, boolean, Error | null] {
    const [state, setState] = useState<T | 'error' | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<Error | null>(null);
    
    const localTruthRef = useRef<T | null>(null);
    const isPendingWrite = useRef<boolean>(false);
    const isDirty = useRef<boolean>(false); // 변경사항이 있는데 아직 저장 시작 안됨 or 저장 중
    const writeTimeout = useRef<number | null>(null);
    const lastSavedJson = useRef<string>("");

    const mergeData = useCallback((incoming: any): T => {
        const initial = getInitialData();
        if (!incoming || typeof incoming !== 'object' || !incoming.students) return initial;
        return { ...initial, ...incoming };
    }, [getInitialData]);

    // [추가] 데이터 용량 관리를 위한 강제 압축 함수
    const compactData = (data: T): T => {
        const MAX_TX = 800; 
        const MAX_CHESS = 400;

        const compact = { ...data };
        if (Array.isArray(compact.transactions) && compact.transactions.length > MAX_TX) {
            // console.log(`[Compact] Trimming transactions: ${compact.transactions.length} -> ${MAX_TX}`);
            compact.transactions = compact.transactions.slice(0, MAX_TX);
        }
        if (Array.isArray(compact.chessMatches) && compact.chessMatches.length > MAX_CHESS) {
            // console.log(`[Compact] Trimming chess matches: ${compact.chessMatches.length} -> ${MAX_CHESS}`);
            compact.chessMatches = compact.chessMatches.slice(0, MAX_CHESS);
        }
        return compact;
    };

    const saveToServer = useCallback(async (data: T) => {
        if (!userId) return;

        const finalData = compactData(data);
        const currentJson = JSON.stringify(finalData);

        // [안전장치] 로컬 스토리지에 백업 (서버 저장 실패 대비)
        try {
            localStorage.setItem(`backup_data_${userId}`, currentJson);
            localStorage.setItem(`backup_timestamp_${userId}`, Date.now().toString());
        } catch (e) {
            console.warn("Local backup failed:", e);
        }

        if (currentJson === lastSavedJson.current) {
            setIsSaving(false);
            isDirty.current = false;
            return;
        }

        try {
            isPendingWrite.current = true;
            setIsSaving(true);
            setSaveError(null); // 에러 초기화

            if (isDemoMode || !db) {
                // 데모 모드일 경우 로컬 스토리지에 저장
                localStorage.setItem(`demo_data_${userId}`, currentJson);
                // 지연 효과 시뮬레이션
                await new Promise(resolve => setTimeout(resolve, 300));
            } else {
                // Firebase 저장
                const docRef = doc(db, 'users', userId);
                await setDoc(docRef, {
                    ...finalData,
                    _lastUpdatedAt: Date.now()
                });
                console.log(`[Firestore Success] Saved to users/${userId}`);
            }
            
            lastSavedJson.current = currentJson;
            isDirty.current = false; // 저장 성공 시 Clean 상태로 변경
        } catch (e: any) {
            console.error(`[Firestore Error] Save failed:`, e);
            setSaveError(e); // 에러 상태 업데이트
            alert("⚠️ 데이터 저장에 실패했습니다! 인터넷 연결을 확인해주세요.");
            // 실패 시 isDirty는 true로 유지하여 재시도 유도
        } finally {
            isPendingWrite.current = false;
            setIsSaving(false);
        }
    }, [userId, isDemoMode]);

    // 브라우저 종료/새로고침 방지 (저장 중이거나 변경사항 있을 때)
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isDirty.current || isPendingWrite.current) {
                // 변경사항이 있으면 즉시 저장 시도 (Best Effort)
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

    useEffect(() => {
        if (!userId) return;

        const loadInitial = async () => {
            if (isDemoMode || !db) {
                const saved = localStorage.getItem(`demo_data_${userId}`);
                const data = saved ? mergeData(JSON.parse(saved)) : getInitialData();
                localTruthRef.current = data;
                setState(data);
                return;
            }

            try {
                const docRef = doc(db, 'users', userId);
                const snap = await getDoc(docRef);
                let initialData: T;

                if (snap.exists()) {
                    initialData = mergeData(snap.data());
                    console.log(`[Firestore Load] Found data for users/${userId}`);
                } else {
                    initialData = getInitialData();
                    await setDoc(docRef, initialData);
                }

                localTruthRef.current = initialData;
                lastSavedJson.current = JSON.stringify(initialData);
                setState(initialData);

                const unsubscribe = onSnapshot(docRef, (docSnap) => {
                    if (isPendingWrite.current || docSnap.metadata.hasPendingWrites) return;

                    if (docSnap.exists()) {
                        const serverData = mergeData(docSnap.data());
                        const serverJson = JSON.stringify(serverData);
                        
                        if (JSON.stringify(localTruthRef.current) !== serverJson) {
                            localTruthRef.current = serverData;
                            lastSavedJson.current = serverJson;
                            setState(serverData);
                        }
                    }
                });

                return unsubscribe;
            } catch (err) {
                console.error("[Firestore Error] Load failed:", err);
                setState('error');
            }
        };

        const subPromise = loadInitial();
        return () => {
            subPromise.then(unsub => unsub?.());
        };
    }, [userId, mergeData]);

    const setDebouncedState: SetState<T> = useCallback((newStateOrFn) => {
        setState(prevState => {
            if (prevState === 'error' || prevState === null) return prevState;

            const nextState = typeof newStateOrFn === 'function'
                ? (newStateOrFn as any)(prevState)
                : newStateOrFn;

            if (!nextState || nextState === 'error') return nextState;

            // 로컬 상태를 즉시 다이어트하여 메모리 및 저장 준비
            const compactedNext = compactData(nextState);
            localTruthRef.current = compactedNext;
            
            // 변경 즉시 Dirty 플래그 설정 및 저장 상태 표시
            isDirty.current = true;
            setIsSaving(true);

            if (writeTimeout.current) window.clearTimeout(writeTimeout.current);
            // 디바운스 시간을 1초로 늘려 잦은 쓰기 방지 및 안정성 확보
            writeTimeout.current = window.setTimeout(() => {
                saveToServer(compactedNext);
                writeTimeout.current = null;
            }, 1000);

            return compactedNext;
        });
    }, [saveToServer]);

    return [state, setDebouncedState, isSaving, saveError];
}
