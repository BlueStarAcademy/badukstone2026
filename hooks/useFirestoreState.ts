
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
    
    // 로컬의 최신 상태를 추적하기 위한 Ref
    const latestStateRef = useRef<T | null>(null);
    // 마지막 로컬 업데이트 시간을 추적 (서버 덮어쓰기 방지용)
    const lastLocalUpdateAt = useRef<number>(0);
    const writeTimeout = useRef<number | null>(null);

    // 초기 데이터 로드
    useEffect(() => {
        if (!userId) {
            setState(null);
            return;
        }

        const init = async () => {
            if (isDemoMode || !db) {
                const saved = localStorage.getItem(`demo_data_${userId}`);
                const data = saved ? JSON.parse(saved) : getInitialData();
                latestStateRef.current = data;
                setState(data);
                return;
            }

            try {
                const docRef = doc(db, 'users', userId);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    const data = snap.data() as T;
                    latestStateRef.current = data;
                    setState(data);
                } else {
                    const initial = getInitialData();
                    await setDoc(docRef, initial);
                    latestStateRef.current = initial;
                    setState(initial);
                }
            } catch (e) {
                console.error("Firestore 초기화 실패:", e);
                setState('error');
            }
        };

        init();
    }, [userId]);

    // [중요] 실시간 구독 로직: 타임스탬프 비교로 과거 데이터가 현재 데이터를 덮어쓰지 못하게 함
    useEffect(() => {
        if (!userId || isDemoMode || !db || state === 'error' || state === null) return;

        const docRef = doc(db, 'users', userId);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            // 로컬에 대기 중인 쓰기가 있다면 SDK가 자동으로 병합하므로 처리를 맡김
            if (docSnap.metadata.hasPendingWrites) return;

            if (docSnap.exists()) {
                const cloudData = docSnap.data() as T;
                const cloudUpdatedAt = (cloudData as any)._updatedAt || 0;

                // 서버 데이터가 내가 마지막으로 수정한 것보다 과거라면 업데이트 무시
                if (cloudUpdatedAt <= lastLocalUpdateAt.current) {
                    return;
                }

                latestStateRef.current = cloudData;
                setState(cloudData);
            }
        });

        return () => unsubscribe();
    }, [userId, state === null]);

    // 저장 실행 함수
    const flushToFirestore = useCallback(async () => {
        if (!userId || isDemoMode || !db || !latestStateRef.current) return;
        
        try {
            const docRef = doc(db, 'users', userId);
            // 저장 시점에 현재 시간을 기록 (서버 충돌 방지용)
            const now = Date.now();
            lastLocalUpdateAt.current = now;
            
            const dataToSave = {
                ...latestStateRef.current,
                _updatedAt: now
            };
            
            await setDoc(docRef, dataToSave);
        } catch (e) {
            console.error("Firestore 저장 실패:", e);
        }
    }, [userId]);

    // 페이지를 떠날 때 미처 저장 못한 데이터 처리
    useEffect(() => {
        const handleBeforeUnload = () => {
            if (isSaving) flushToFirestore();
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isSaving, flushToFirestore]);

    const setDebouncedState: SetState<T> = useCallback((newStateOrFn) => {
        setState(prevState => {
            const nextState = typeof newStateOrFn === 'function'
                ? (newStateOrFn as any)(prevState)
                : newStateOrFn;

            if (!nextState || nextState === 'error' || !userId) return nextState;

            // 1. Ref 즉시 업데이트 (항상 최신본 유지)
            latestStateRef.current = nextState;
            // 2. 로컬 업데이트 시간 기록
            lastLocalUpdateAt.current = Date.now();

            // 데모 모드 처리
            if (isDemoMode || !db) {
                localStorage.setItem(`demo_data_${userId}`, JSON.stringify(nextState));
                return nextState;
            }

            // 3. Firestore 저장 예약
            setIsSaving(true);
            if (writeTimeout.current) window.clearTimeout(writeTimeout.current);
            
            writeTimeout.current = window.setTimeout(async () => {
                await flushToFirestore();
                setIsSaving(false);
                writeTimeout.current = null;
            }, 500); // 0.5초 디바운스

            return nextState;
        });
    }, [userId, flushToFirestore]);

    return [state, setDebouncedState, isSaving];
}
