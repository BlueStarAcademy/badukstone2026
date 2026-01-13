
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
            const docRef = doc(db, 'users', userId);
            await setDoc(docRef, {
                ...data,
                _lastUpdatedAt: Date.now()
            });
            lastSavedJson.current = currentJson;
            console.log("Firestore Save Success:", userId);
        } catch (e) {
            console.error("Firestore Save Failure:", e);
        } finally {
            // 저장 완료 후 플래그 해제
            isPendingWrite.current = false;
            setIsSaving(false);
        }
    }, [userId, isDemoMode]);

    useEffect(() => {
        const handleBeforeUnload = () => {
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
                console.error("Fetch Error:", err);
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
            
            // [수정] 쓰기 대기 시작 알림 및 저장 중 표시 활성화
            isPendingWrite.current = true;
            setIsSaving(true);

            if (writeTimeout.current) window.clearTimeout(writeTimeout.current);
            writeTimeout.current = window.setTimeout(() => {
                saveToServer(nextState);
                writeTimeout.current = null;
            }, 500); // 0.5초 후 저장 시작

            return nextState;
        });
    }, [saveToServer]);

    return [state, setDebouncedState, isSaving];
}
