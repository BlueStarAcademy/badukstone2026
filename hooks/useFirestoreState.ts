
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
    
    // 로컬 업데이트의 타임스탬프를 추적하여 stale한 스냅샷을 무시함
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
                setState(saved ? JSON.parse(saved) : getInitialData());
                return;
            }

            try {
                const docRef = doc(db, 'users', userId);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    setState(snap.data() as T);
                } else {
                    const initial = getInitialData();
                    await setDoc(docRef, initial);
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
            // 1. 로컬에 아직 반영되지 않은 쓰기가 있다면 무시
            if (docSnap.metadata.hasPendingWrites) return;

            if (docSnap.exists()) {
                const cloudData = docSnap.data() as T;
                
                // 2. 서버 데이터의 시간 정보가 로컬 업데이트보다 이전이라면 무시 (Race Condition 방지)
                const cloudUpdatedAt = (cloudData as any)._lastSyncAt || 0;
                if (cloudUpdatedAt < lastLocalUpdateAt.current) {
                    return;
                }

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

            // 로컬 타임스탬프 업데이트
            const now = Date.now();
            lastLocalUpdateAt.current = now;

            // 동기화용 필드 추가 (서버 스냅샷 거름종이 역할)
            const stateToSave = {
                ...nextState,
                _lastSyncAt: now
            };

            // 데모 모드 처리
            if (isDemoMode || !db) {
                localStorage.setItem(`demo_data_${userId}`, JSON.stringify(stateToSave));
                return nextState;
            }

            // Firestore 저장 디바운스 (500ms)
            if (writeTimeout.current) window.clearTimeout(writeTimeout.current);
            
            writeTimeout.current = window.setTimeout(async () => {
                try {
                    if (db) {
                        const docRef = doc(db, 'users', userId);
                        // 전체 덮어쓰기로 데이터 일관성 유지
                        await setDoc(docRef, stateToSave);
                    }
                } catch (error) {
                    console.error("Firestore 저장 실패:", error);
                } finally {
                    writeTimeout.current = null;
                }
            }, 500); 

            return nextState;
        });
    }, [userId]);

    return [state, setDebouncedState];
}
