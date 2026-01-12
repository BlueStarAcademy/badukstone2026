
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
    
    // 핵심: 로컬에서 쓰기가 진행 중임을 알리는 레퍼런스
    const isWritingLocked = useRef(false);
    const writeTimeout = useRef<number | null>(null);
    const lockReleaseTimeout = useRef<number | null>(null);

    useEffect(() => {
        if (!userId) {
            setState(null);
            return;
        }

        if (isDemoMode || !db) {
            const saved = localStorage.getItem(`demo_data_${userId}`);
            if (saved) {
                try {
                    setState(JSON.parse(saved));
                } catch (e) {
                    setState(getInitialData());
                }
            } else {
                setState(getInitialData());
            }
            return;
        }

        const docRef = doc(db, 'users', userId);

        // 초기 로드
        const initLoad = async () => {
            try {
                const snap = await getDoc(docRef);
                if (!snap.exists()) {
                    const initial = getInitialData();
                    await setDoc(docRef, initial);
                    setState(initial);
                }
            } catch (e) {
                console.error("Firestore 초기 로드 실패:", e);
            }
        };
        initLoad();

        // 실시간 구독
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            // 로컬에서 쓰기 중이거나 서버에 펜딩된 쓰기가 있다면 스냅샷(서버 데이터) 무시
            if (isWritingLocked.current || docSnap.metadata.hasPendingWrites) {
                return;
            }

            if (docSnap.exists()) {
                const cloudData = docSnap.data() as T;
                setState(cloudData);
            }
        }, (error) => {
            console.error("Firestore 구독 에러:", error);
        });

        return () => {
            unsubscribe();
            if (writeTimeout.current) window.clearTimeout(writeTimeout.current);
            if (lockReleaseTimeout.current) window.clearTimeout(lockReleaseTimeout.current);
        };
    }, [userId, getInitialData]);

    const setDebouncedState: SetState<T> = useCallback((newStateOrFn) => {
        setState(prevState => {
            const newState = typeof newStateOrFn === 'function'
                ? (newStateOrFn as any)(prevState)
                : newStateOrFn;

            if (newState && newState !== 'error' && userId) {
                if (isDemoMode || !db) {
                    localStorage.setItem(`demo_data_${userId}`, JSON.stringify(newState));
                    return newState;
                }

                // 1. 즉시 잠금 활성화 (서버 스냅샷 무시 시작)
                isWritingLocked.current = true;

                // 2. 기존 타이머 제거
                if (writeTimeout.current) window.clearTimeout(writeTimeout.current);
                if (lockReleaseTimeout.current) window.clearTimeout(lockReleaseTimeout.current);
                
                // 3. 디바운스된 쓰기 작업 예약
                writeTimeout.current = window.setTimeout(async () => {
                    try {
                        const docRef = doc(db, 'users', userId);
                        // 데이터 유실 방지를 위해 merge가 아닌 전체 덮어쓰기 수행
                        await setDoc(docRef, newState);
                    } catch (error) {
                        console.error("Firestore 저장 실패:", error);
                    } finally {
                        // 4. 저장 완료 후 즉시 잠금을 풀지 않고 1.5초 뒤에 해제 (서버 스냅샷 지연 보정)
                        lockReleaseTimeout.current = window.setTimeout(() => {
                            isWritingLocked.current = false;
                        }, 1500);
                        writeTimeout.current = null;
                    }
                }, 1000); // 1초 디바운스
            }
            return newState;
        });
    }, [userId]);

    return [state, setDebouncedState];
}
