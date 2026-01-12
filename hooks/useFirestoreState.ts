
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { doc, setDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { db, isDemoMode } from '../firebase';
import type { AppData } from '../types';

type SetState<T> = React.Dispatch<React.SetStateAction<T | 'error' | null>>;

/**
 * useFirestoreState Hook
 * - 로컬 상태를 즉시 업데이트 (Optimistic Update)
 * - Firestore와 비동기적으로 데이터 동기화
 * - 스냅샷 충돌 방지 로직 포함
 */
export function useFirestoreState<T extends AppData>(
    userId: string | null,
    getInitialData: () => T
): [T | 'error' | null, SetState<T>] {
    const [state, setState] = useState<T | 'error' | null>(null);
    
    // 로컬에서의 쓰기 작업 상태를 추적하는 Ref
    const pendingWritesCount = useRef(0);
    const writeTimeout = useRef<number | null>(null);
    const latestStateRef = useRef<T | null>(null);

    // 초기 데이터 로드 및 스냅샷 리스너 설정
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
                    latestStateRef.current = parsed;
                } catch (e) {
                    const initial = getInitialData();
                    setState(initial);
                    latestStateRef.current = initial;
                }
            } else {
                const initial = getInitialData();
                setState(initial);
                latestStateRef.current = initial;
            }
            return;
        }

        const docRef = doc(db, 'users', userId);

        // 첫 로드 시 데이터가 없으면 초기 데이터 생성
        const initLoad = async () => {
            try {
                const snap = await getDoc(docRef);
                if (!snap.exists()) {
                    const initial = getInitialData();
                    await setDoc(docRef, initial);
                    setState(initial);
                    latestStateRef.current = initial;
                }
            } catch (e) {
                console.error("Initial load failed:", e);
            }
        };
        initLoad();

        // 실시간 업데이트 구독
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            // 중요: 로컬에서 서버로 전송 중인 쓰기가 있다면 서버 스냅샷(구버전일 가능성 높음) 무시
            if (docSnap.metadata.hasPendingWrites || pendingWritesCount.current > 0) {
                return;
            }

            if (docSnap.exists()) {
                const cloudData = docSnap.data() as T;
                setState(cloudData);
                latestStateRef.current = cloudData;
            }
        }, (error) => {
            console.error("Firestore sync error:", error);
        });

        return () => unsubscribe();
    }, [userId, getInitialData]);

    // 상태 업데이트 함수 (Debounced Firestore Sync)
    const setDebouncedState: SetState<T> = useCallback((newStateOrFn) => {
        setState(prevState => {
            const newState = typeof newStateOrFn === 'function'
                ? (newStateOrFn as any)(prevState)
                : newStateOrFn;

            if (newState && newState !== 'error') {
                latestStateRef.current = newState;
                
                if (userId) {
                    if (isDemoMode || !db) {
                        localStorage.setItem(`demo_data_${userId}`, JSON.stringify(newState));
                    } else {
                        // 쓰기 대기 카운트 증가
                        pendingWritesCount.current++;

                        if (writeTimeout.current) window.clearTimeout(writeTimeout.current);
                        
                        writeTimeout.current = window.setTimeout(async () => {
                            try {
                                const docRef = doc(db, 'users', userId);
                                // 데이터 정합성을 위해 전체 문서를 덮어쓰기
                                await setDoc(docRef, newState);
                            } catch (error) {
                                console.error("Firestore write failed:", error);
                            } finally {
                                // 쓰기 작업이 끝나면 카운트 감소 (지연 처리로 스냅샷 레이스 컨디션 방어)
                                setTimeout(() => {
                                    pendingWritesCount.current = Math.max(0, pendingWritesCount.current - 1);
                                }, 1500);
                                writeTimeout.current = null;
                            }
                        }, 500); // 0.5초 디바운스로 반응성 향상
                    }
                }
            }
            return newState;
        });
    }, [userId]);

    return [state, setDebouncedState];
}
