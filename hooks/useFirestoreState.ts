
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
    
    // 로컬의 가장 최신 상태를 참조하기 위한 Ref
    const latestStateRef = useRef<T | null>(null);
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

    // 실시간 구독 로직
    useEffect(() => {
        if (!userId || isDemoMode || !db || state === 'error' || state === null) return;

        const docRef = doc(db, 'users', userId);
        
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            // 로컬에 대기 중인 쓰기가 있다면 서버 데이터로 덮어쓰지 않음
            if (docSnap.metadata.hasPendingWrites) return;

            if (docSnap.exists()) {
                const cloudData = docSnap.data() as T;
                
                // 타임스탬프 비교로 Race Condition 방지
                const cloudUpdatedAt = (cloudData as any)._lastSyncAt || 0;
                if (cloudUpdatedAt < lastLocalUpdateAt.current) {
                    return;
                }

                latestStateRef.current = cloudData;
                setState(cloudData);
            }
        }, (err) => {
            console.error("Firestore 구독 에러:", err);
        });

        return () => unsubscribe();
    }, [userId, state === null]);

    const setDebouncedState: SetState<T> = useCallback((newStateOrFn) => {
        setState(prevState => {
            const nextState = typeof newStateOrFn === 'function'
                ? (newStateOrFn as any)(prevState)
                : newStateOrFn;

            if (!nextState || nextState === 'error' || !userId) return nextState;

            // 로컬 타임스탬프 및 Ref 업데이트 (즉시 반영)
            const now = Date.now();
            lastLocalUpdateAt.current = now;
            
            const stateToSave = {
                ...nextState,
                _lastSyncAt: now
            };
            
            latestStateRef.current = stateToSave;

            // 데모 모드 처리
            if (isDemoMode || !db) {
                localStorage.setItem(`demo_data_${userId}`, JSON.stringify(stateToSave));
                return nextState;
            }

            // Firestore 저장 디바운스
            setIsSaving(true);
            if (writeTimeout.current) window.clearTimeout(writeTimeout.current);
            
            writeTimeout.current = window.setTimeout(async () => {
                try {
                    if (db && userId && latestStateRef.current) {
                        const docRef = doc(db, 'users', userId);
                        // Ref에 담긴 '가장 마지막' 상태를 저장함 (여러번 호출 시 최종본만 저장되도록)
                        await setDoc(docRef, latestStateRef.current);
                    }
                } catch (error) {
                    console.error("Firestore 저장 실패:", error);
                } finally {
                    setIsSaving(false);
                    writeTimeout.current = null;
                }
            }, 800); // 800ms 디바운스 (연속 클릭 대응)

            return nextState;
        });
    }, [userId]);

    return [state, setDebouncedState, isSaving];
}
