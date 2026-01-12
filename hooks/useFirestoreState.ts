
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
    
    const latestStateRef = useRef<T | null>(null);
    const writeTimeout = useRef<number | null>(null);
    const isDirty = useRef<boolean>(false);

    // [중요] 최신 데이터를 Firestore에 즉시 기록하는 함수
    const flushToFirestore = useCallback(async () => {
        if (!isDirty.current || !userId || isDemoMode || !db || !latestStateRef.current) return;
        
        try {
            const docRef = doc(db, 'users', userId);
            const dataToSave = {
                ...latestStateRef.current,
                _lastSyncAt: Date.now()
            };
            await setDoc(docRef, dataToSave);
            isDirty.current = false;
            console.log("Firestore 강제 저장 성공");
        } catch (e) {
            console.error("Firestore 강제 저장 실패:", e);
        }
    }, [userId]);

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

    // 실시간 구독 (서버에서 변경 시 로컬 반영)
    useEffect(() => {
        if (!userId || isDemoMode || !db || state === 'error' || state === null) return;

        const docRef = doc(db, 'users', userId);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            // 로컬에 아직 전송되지 않은 데이터가 있다면 서버 데이터로 덮어쓰지 않음 (충돌 방지)
            if (docSnap.metadata.hasPendingWrites || isDirty.current) return;

            if (docSnap.exists()) {
                const cloudData = docSnap.data() as T;
                latestStateRef.current = cloudData;
                setState(cloudData);
            }
        });

        return () => unsubscribe();
    }, [userId, state === null]);

    // [중요] 새로고침/창 닫기 시 미처 저장되지 않은 데이터 강제 저장
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isDirty.current) {
                flushToFirestore();
                // 브라우저에 따라 경고창을 띄울 수도 있음
                // e.preventDefault();
                // e.returnValue = '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            // 컴포넌트 언마운트 시에도 시도
            if (isDirty.current) flushToFirestore();
        };
    }, [flushToFirestore]);

    const setDebouncedState: SetState<T> = useCallback((newStateOrFn) => {
        setState(prevState => {
            const nextState = typeof newStateOrFn === 'function'
                ? (newStateOrFn as any)(prevState)
                : newStateOrFn;

            if (!nextState || nextState === 'error' || !userId) return nextState;

            // 로컬 반영
            latestStateRef.current = nextState;
            isDirty.current = true;

            // 데모 모드
            if (isDemoMode || !db) {
                localStorage.setItem(`demo_data_${userId}`, JSON.stringify(nextState));
                isDirty.current = false;
                return nextState;
            }

            // 저장 예약 (300ms로 단축하여 체감 속도 향상)
            setIsSaving(true);
            if (writeTimeout.current) window.clearTimeout(writeTimeout.current);
            
            writeTimeout.current = window.setTimeout(async () => {
                await flushToFirestore();
                setIsSaving(false);
                writeTimeout.current = null;
            }, 300); 

            return nextState;
        });
    }, [userId, flushToFirestore]);

    return [state, setDebouncedState, isSaving];
}
