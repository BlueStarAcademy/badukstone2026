
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
    
    // 로컬의 '진실'을 담고 있는 Ref (서버 데이터보다 우선함)
    const localTruthRef = useRef<T | null>(null);
    // 현재 서버에 쓰는 중임을 알리는 플래그
    const isPendingWrite = useRef<boolean>(false);
    const writeTimeout = useRef<number | null>(null);

    const mergeData = useCallback((incoming: any): T => {
        const initial = getInitialData();
        if (!incoming || typeof incoming !== 'object' || !incoming.students) return initial;
        return { ...initial, ...incoming };
    }, [getInitialData]);

    // 1. 초기 데이터 로드 (딱 한 번만)
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
                setState(initialData);

                // 실시간 리스너 시작 (다른 기기에서 수정한 경우를 위해)
                const unsubscribe = onSnapshot(docRef, (docSnap) => {
                    // [핵심] 내가 지금 쓰고 있는 중이라면 서버에서 오는 데이터는 무조건 쓰레기(옛날 것)로 간주하고 무시
                    if (isPendingWrite.current || docSnap.metadata.hasPendingWrites) {
                        return;
                    }

                    if (docSnap.exists()) {
                        const serverData = mergeData(docSnap.data());
                        // 로컬 데이터와 서버 데이터가 다를 때만 업데이트
                        if (JSON.stringify(localTruthRef.current) !== JSON.stringify(serverData)) {
                            localTruthRef.current = serverData;
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

    // 2. 데이터 수정 핸들러
    const setDebouncedState: SetState<T> = useCallback((newStateOrFn) => {
        setState(prevState => {
            if (prevState === 'error' || prevState === null) return prevState;

            const nextState = typeof newStateOrFn === 'function'
                ? (newStateOrFn as any)(prevState)
                : newStateOrFn;

            if (!nextState || nextState === 'error') return nextState;

            // 로컬 Ref를 즉시 갱신 (이게 진실임)
            localTruthRef.current = nextState;

            if (isDemoMode || !db) {
                if (userId) localStorage.setItem(`demo_data_${userId}`, JSON.stringify(nextState));
                return nextState;
            }

            // 쓰기 잠금 활성화
            isPendingWrite.current = true;
            setIsSaving(true);

            if (writeTimeout.current) window.clearTimeout(writeTimeout.current);
            
            writeTimeout.current = window.setTimeout(async () => {
                if (!userId || !db) return;
                try {
                    const docRef = doc(db, 'users', userId);
                    // 데이터를 서버로 밀어넣음
                    await setDoc(docRef, {
                        ...nextState,
                        _lastUpdatedAt: Date.now()
                    });
                } catch (e) {
                    console.error("Firestore Save Failure:", e);
                } finally {
                    // 서버 저장이 완전히 끝난 후 약간의 딜레이를 주어 리스너 안정화
                    setTimeout(() => {
                        isPendingWrite.current = false;
                        setIsSaving(false);
                    }, 500);
                }
                writeTimeout.current = null;
            }, 600);

            return nextState;
        });
    }, [userId]);

    return [state, setDebouncedState, isSaving];
}
