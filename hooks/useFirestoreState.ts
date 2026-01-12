
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { doc, setDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { db, isDemoMode } from '../firebase';
import type { AppData } from '../types';

type SetState<T> = React.Dispatch<React.SetStateAction<T | 'error' | null>>;

export function useFirestoreState<T extends AppData>(
    userId: string | null,
    getInitialData: () => T
): [T | 'error' | null, SetState<T>] {
    const [state, setState] = useState<T | 'error' | null>(null);
    
    // 쓰기 작업 중인지 여부를 확인하는 플래그 (서버 스냅샷 무시용)
    const isWriting = useRef(false);
    const writeTimeout = useRef<number | null>(null);
    const latestLocalData = useRef<T | null>(null);

    useEffect(() => {
        if (!userId) {
            setState(null);
            return;
        }

        if (isDemoMode || !db) {
            const saved = localStorage.getItem(`demo_data_${userId}`);
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    setState(parsed);
                    latestLocalData.current = parsed;
                } catch (e) {
                    const initial = getInitialData();
                    setState(initial);
                    latestLocalData.current = initial;
                }
            } else {
                const initial = getInitialData();
                setState(initial);
                latestLocalData.current = initial;
            }
            return;
        }

        const docRef = doc(db, 'users', userId);

        const initLoad = async () => {
            try {
                const snap = await getDoc(docRef);
                if (!snap.exists()) {
                    const initial = getInitialData();
                    await setDoc(docRef, initial);
                    setState(initial);
                    latestLocalData.current = initial;
                }
            } catch (e) {
                console.error("Initial load failed:", e);
            }
        };
        initLoad();

        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            // 로컬에서 쓰기가 진행 중이거나, 서버 응답 대기 중인 펜딩 쓰기가 있다면 스냅샷 무시
            if (isWriting.current || docSnap.metadata.hasPendingWrites) {
                return;
            }

            if (docSnap.exists()) {
                const cloudData = docSnap.data() as T;
                setState(cloudData);
                latestLocalData.current = cloudData;
            }
        }, (error) => {
            console.error("Firestore snapshot error:", error);
        });

        return () => unsubscribe();
    }, [userId, getInitialData]);

    const setDebouncedState: SetState<T> = useCallback((newStateOrFn) => {
        setState(prevState => {
            const newState = typeof newStateOrFn === 'function'
                ? (newStateOrFn as any)(prevState)
                : newStateOrFn;

            if (newState && newState !== 'error') {
                latestLocalData.current = newState;
                
                if (userId) {
                    if (isDemoMode || !db) {
                        localStorage.setItem(`demo_data_${userId}`, JSON.stringify(newState));
                        return newState;
                    }

                    // 디바운스 처리: 마지막 입력 후 800ms 뒤에 서버 전송
                    if (writeTimeout.current) window.clearTimeout(writeTimeout.current);
                    
                    writeTimeout.current = window.setTimeout(async () => {
                        isWriting.current = true;
                        try {
                            const docRef = doc(db, 'users', userId);
                            // merge를 사용하지 않고 전체 상태를 덮어씌워 정합성 보장
                            await setDoc(docRef, newState);
                        } catch (error) {
                            console.error("Failed to save to Firestore:", error);
                        } finally {
                            // 서버 전송 완료 후 스냅샷을 수용하기까지 약간의 유예 시간을 둠
                            setTimeout(() => {
                                isWriting.current = false;
                            }, 1000);
                            writeTimeout.current = null;
                        }
                    }, 800);
                }
            }
            return newState;
        });
    }, [userId]);

    return [state, setDebouncedState];
}
