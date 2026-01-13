
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
    
    // 현재 서버와 통신 중인지 확인하는 플래그
    const isWritingRef = useRef<boolean>(false);
    const writeTimeout = useRef<number | null>(null);

    const mergeData = useCallback((incoming: any): T => {
        const initial = getInitialData();
        if (!incoming || typeof incoming !== 'object' || !incoming.students) return initial;
        return { ...initial, ...incoming };
    }, [getInitialData]);

    // 1. 서버 리스너 (읽기 전 전용)
    useEffect(() => {
        if (!userId || isDemoMode || !db) {
            if (userId) {
                const saved = localStorage.getItem(`demo_data_${userId}`);
                setState(saved ? mergeData(JSON.parse(saved)) : getInitialData());
            }
            return;
        }

        const docRef = doc(db, 'users', userId);
        
        // 실시간 리스너 연결
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            // [근본 조치 3] 내가 지금 서버에 쓰고 있는 중이라면, 서버에서 오는 데이터(내 쓰기 결과 포함)를 무시합니다.
            // Firebase SDK가 내부적으로 UI를 먼저 업데이트하므로(Optimistic UI), 
            // 굳이 서버 응답을 다시 받아서 화면을 갱신할 필요가 없습니다.
            if (docSnap.metadata.hasPendingWrites || isWritingRef.current) {
                return;
            }

            if (docSnap.exists()) {
                setState(mergeData(docSnap.data()));
            } else {
                // 문서가 아예 없는 최초 접근 시에만 생성
                const initial = getInitialData();
                setDoc(docRef, initial);
                setState(initial);
            }
        }, (err) => {
            console.error("Firestore Error:", err);
            setState('error');
        });

        return () => unsubscribe();
    }, [userId, mergeData]);

    // 2. 상태 변경 핸들러 (쓰기 전용)
    const setDebouncedState: SetState<T> = useCallback((newStateOrFn) => {
        setState(prevState => {
            if (prevState === 'error' || prevState === null) return prevState;

            const nextState = typeof newStateOrFn === 'function'
                ? (newStateOrFn as any)(prevState)
                : newStateOrFn;

            if (!nextState || nextState === 'error') return nextState;

            // 로컬 UI는 즉시 갱신 (사용자 경험)
            if (isDemoMode || !db) {
                if (userId) localStorage.setItem(`demo_data_${userId}`, JSON.stringify(nextState));
                return nextState;
            }

            // [근본 조치 4] 쓰기 작업 시작 알림 및 디바운싱
            isWritingRef.current = true;
            setIsSaving(true);

            if (writeTimeout.current) window.clearTimeout(writeTimeout.current);
            
            writeTimeout.current = window.setTimeout(async () => {
                if (!userId || !db) return;
                try {
                    const docRef = doc(db, 'users', userId);
                    // 전체 데이터를 서버로 즉시 전송
                    await setDoc(docRef, {
                        ...nextState,
                        _lastSync: Date.now() // 동기화 확인용 필드
                    });
                } catch (e) {
                    console.error("Firestore Save Error:", e);
                } finally {
                    // 쓰기가 완전히 끝났을 때만 플래그 해제
                    isWritingRef.current = false;
                    setIsSaving(false);
                }
                writeTimeout.current = null;
            }, 500); // 0.5초 대기 후 즉시 서버 반영

            return nextState;
        });
    }, [userId]);

    return [state, setDebouncedState, isSaving];
}
