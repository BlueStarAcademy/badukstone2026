
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { doc, setDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { db, isDemoMode } from '../firebase';
import type { AppData } from '../types';

type SetState<T> = React.Dispatch<React.SetStateAction<T | 'error' | null>>;

export function useFirestoreState<T extends AppData>(
    userId: string | null,
    getInitialData: () => T
): [T | 'error' | null, SetState<T>, boolean] {
    const [state, setState] = useState<T | 'error' | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    
    const localTruthRef = useRef<T | null>(null);
    const isPendingWrite = useRef<boolean>(false);
    const writeTimeout = useRef<number | null>(null);
    const lastSavedJson = useRef<string>("");

    const mergeData = useCallback((incoming: any): T => {
        const initial = getInitialData();
        if (!incoming || typeof incoming !== 'object' || !incoming.students) return initial;
        return { ...initial, ...incoming };
    }, [getInitialData]);

    // [추가] 데이터 용량 관리를 위한 강제 압축 함수
    const compactData = (data: T): T => {
        const MAX_TX = 800; // 좀 더 보수적으로 800건으로 제한
        const MAX_CHESS = 400;

        const compact = { ...data };
        if (Array.isArray(compact.transactions) && compact.transactions.length > MAX_TX) {
            console.log(`[Compact] Trimming transactions: ${compact.transactions.length} -> ${MAX_TX}`);
            compact.transactions = compact.transactions.slice(0, MAX_TX);
        }
        if (Array.isArray(compact.chessMatches) && compact.chessMatches.length > MAX_CHESS) {
            console.log(`[Compact] Trimming chess matches: ${compact.chessMatches.length} -> ${MAX_CHESS}`);
            compact.chessMatches = compact.chessMatches.slice(0, MAX_CHESS);
        }
        return compact;
    };

    const saveToServer = useCallback(async (data: T) => {
        if (!userId || !db || isDemoMode) {
            setIsSaving(false);
            return;
        }
        
        // 저장 직전 최종 데이터 압축
        const finalData = compactData(data);
        const currentJson = JSON.stringify(finalData);

        if (currentJson === lastSavedJson.current) {
            setIsSaving(false);
            return;
        }

        try {
            isPendingWrite.current = true;
            setIsSaving(true);
            const docRef = doc(db, 'users', userId);
            
            await setDoc(docRef, {
                ...finalData,
                _lastUpdatedAt: Date.now()
            });
            
            lastSavedJson.current = currentJson;
            console.log(`[Firestore Success] Saved to users/${userId} (Compact Mode)`);
        } catch (e: any) {
            console.error(`[Firestore Error] Save failed:`, e);
            // 만약 여전히 용량 부족이라면 더 강하게 압축 시도 (필요시)
        } finally {
            isPendingWrite.current = false;
            setIsSaving(false);
        }
    }, [userId, isDemoMode]);

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isPendingWrite.current && localTruthRef.current) {
                saveToServer(localTruthRef.current);
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
            setIsSaving(true);

            if (writeTimeout.current) window.clearTimeout(writeTimeout.current);
            writeTimeout.current = window.setTimeout(() => {
                saveToServer(compactedNext);
                writeTimeout.current = null;
            }, 400);

            return compactedNext;
        });
    }, [saveToServer]);

    return [state, setDebouncedState, isSaving];
}
