
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

    const saveToServer = useCallback(async (data: T) => {
        if (!userId || !db || isDemoMode) {
            setIsSaving(false);
            return;
        }
        
        const currentJson = JSON.stringify(data);
        if (currentJson === lastSavedJson.current) {
            setIsSaving(false);
            return;
        }

        try {
            isPendingWrite.current = true;
            setIsSaving(true);
            const docRef = doc(db, 'users', userId);
            
            // [중요] 비동기 쓰기가 완료될 때까지 await 하여 성공 여부 확인
            await setDoc(docRef, {
                ...data,
                _lastUpdatedAt: Date.now()
            });
            
            lastSavedJson.current = currentJson;
            console.log(`[Firestore Success] Saved to users/${userId}`);
        } catch (e: any) {
            console.error(`[Firestore Error] Save failed for users/${userId}:`, e);
            if (e.code === 'permission-denied') {
                alert("서버 저장 권한이 없습니다. Firebase Rules 설정을 확인하세요.");
            }
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
                // 캐시가 아닌 서버에서 직접 가져오도록 유도
                const snap = await getDoc(docRef);
                let initialData: T;

                if (snap.exists()) {
                    initialData = mergeData(snap.data());
                    console.log(`[Firestore Load] Found data for users/${userId}`);
                } else {
                    console.log(`[Firestore Load] No data found for users/${userId}, creating initial...`);
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

            localTruthRef.current = nextState;
            setIsSaving(true);

            if (writeTimeout.current) window.clearTimeout(writeTimeout.current);
            writeTimeout.current = window.setTimeout(() => {
                saveToServer(nextState);
                writeTimeout.current = null;
            }, 400); // 0.4초 디바운스

            return nextState;
        });
    }, [saveToServer]);

    return [state, setDebouncedState, isSaving];
}
