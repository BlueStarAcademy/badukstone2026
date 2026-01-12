
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db, isDemoMode } from '../firebase';
import type { AppData } from '../types';

type SetState<T> = React.Dispatch<React.SetStateAction<T | 'error' | null>>;

export function useFirestoreState<T extends AppData>(
    userId: string | null,
    getInitialData: () => T
): [T | 'error' | null, SetState<T>] {
    const [state, setState] = useState<T | 'error' | null>(null);
    const isWriting = useRef(false);
    const writeTimeout = useRef<number | null>(null);
    const lastWriteCompleteTime = useRef<number>(0);

    useEffect(() => {
        if (!userId) {
            setState(null);
            return;
        }

        if (isDemoMode || !db) {
            const initialData = getInitialData();
            const saved = localStorage.getItem(`demo_data_${userId}`);
            if (saved) {
                try {
                    setState(JSON.parse(saved));
                } catch (e) {
                    setState(initialData);
                }
            } else {
                setState(initialData);
            }
            return;
        }

        const docRef = doc(db, 'users', userId);

        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            // 핵심 수정: 로컬 변경사항이 아직 서버로 전송 중(Pending)이라면 서버에서 오는 스냅샷(과거 데이터일 확률 높음)을 무시합니다.
            if (docSnap.metadata.hasPendingWrites) return;
            
            // 쓰기 작업 직후 짧은 시간 동안 발생하는 스냅샷 플리커 방지
            if (isWriting.current || (Date.now() - lastWriteCompleteTime.current < 2000)) return;

            if (docSnap.exists()) {
                const cloudData = docSnap.data() as Partial<T>;
                const initialState = getInitialData();
                
                // 얕은 병합 대신 주요 필드들을 보존하며 병합
                const mergedData = {
                    ...initialState,
                    ...cloudData,
                    generalSettings: { ...initialState.generalSettings, ...(cloudData.generalSettings || {}) },
                    groupSettings: { ...initialState.groupSettings, ...(cloudData.groupSettings || {}) },
                    eventSettings: { ...initialState.eventSettings, ...(cloudData.eventSettings || {}) },
                    tournamentSettings: { ...initialState.tournamentSettings, ...(cloudData.tournamentSettings || {}) },
                    // 배열 데이터 유실 방지
                    students: cloudData.students || initialState.students || [],
                    missions: cloudData.missions || initialState.missions || [],
                    specialMissions: cloudData.specialMissions || initialState.specialMissions || [],
                    transactions: cloudData.transactions || initialState.transactions || [],
                };
                setState(mergedData as T);
            } else {
                const initialData = getInitialData();
                setDoc(docRef, initialData);
                setState(initialData);
            }
        }, (error) => {
            console.error("Firestore snapshot error:", error);
            // 에러 시 롤백하지 않고 기존 상태 유지 시도
        });

        return () => unsubscribe();
    }, [userId, getInitialData]);

    const setDebouncedState: SetState<T> = useCallback((newStateOrFn) => {
        setState(prevState => {
            const newState = typeof newStateOrFn === 'function'
                ? newStateOrFn(prevState)
                : newStateOrFn;

            if (newState && newState !== 'error' && userId) {
                if (isDemoMode || !db) {
                    localStorage.setItem(`demo_data_${userId}`, JSON.stringify(newState));
                    return newState;
                }

                if (writeTimeout.current) {
                    clearTimeout(writeTimeout.current);
                }
                
                isWriting.current = true;
                
                writeTimeout.current = window.setTimeout(async () => {
                    try {
                        const docRef = doc(db, 'users', userId);
                        // merge: true를 사용하여 변경된 필드만 안전하게 업데이트
                        await setDoc(docRef, newState, { merge: true });
                        lastWriteCompleteTime.current = Date.now();
                    } catch (error) {
                        console.error("Failed to save data to Firestore:", error);
                    } finally {
                        // 서버 응답 처리 대기 후 쓰기 상태 해제
                        setTimeout(() => {
                            isWriting.current = false;
                        }, 500);
                        writeTimeout.current = null;
                    }
                }, 1000); 
            }
            return newState;
        });
    }, [userId]);

    return [state, setDebouncedState];
}
