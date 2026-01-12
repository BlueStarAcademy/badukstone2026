
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
            // 1. 로컬 쓰기 중이거나 방금 완료된 경우 스냅샷 무시 (Flicker 방지)
            if (isWriting.current || (Date.now() - lastWriteCompleteTime.current < 2500)) return;
            
            // 2. 서버 메타데이터 확인: 로컬 변경사항이 아직 서버로 전송 중(Pending)이라면 스냅샷 무시
            // 이를 통해 setDoc 완료 직후 들어오는 '이전 데이터 스냅샷'에 의한 덮어쓰기를 원천 차단합니다.
            if (docSnap.metadata.hasPendingWrites) return;

            if (docSnap.exists()) {
                const cloudData = docSnap.data() as Partial<T>;
                const initialState = getInitialData();
                
                // 모든 상위 레벨 키에 대해 안전하게 병합 (누락된 필드 방지)
                const mergedData = {
                    ...initialState,
                    ...cloudData,
                    // 깊은 병합이 필요한 설정 객체들 처리
                    generalSettings: { ...initialState.generalSettings, ...(cloudData.generalSettings || {}) },
                    groupSettings: { ...initialState.groupSettings, ...(cloudData.groupSettings || {}) },
                    eventSettings: { ...initialState.eventSettings, ...(cloudData.eventSettings || {}) },
                    shopSettings: { ...initialState.shopSettings, ...(cloudData.shopSettings || {}) },
                    tournamentSettings: { ...initialState.tournamentSettings, ...(cloudData.tournamentSettings || {}) },
                    // 배열 데이터가 클라우드에 없는 경우 초기값 유지
                    specialMissions: cloudData.specialMissions || initialState.specialMissions || [],
                    chessMissions: cloudData.chessMissions || initialState.chessMissions || [],
                    individualMissionSeries: cloudData.individualMissionSeries || initialState.individualMissionSeries || [],
                };
                setState(mergedData as T);
            } else {
                const initialData = getInitialData();
                setDoc(docRef, initialData);
                setState(initialData);
            }
        }, (error) => {
            console.error("Firestore snapshot error:", error);
            setState(getInitialData()); 
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
                
                // 쓰기 시작됨을 즉시 알림
                isWriting.current = true;
                
                writeTimeout.current = window.setTimeout(async () => {
                    try {
                        const docRef = doc(db, 'users', userId);
                        // merge: true를 사용하여 전체 문서를 덮어쓰지 않고 변경된 필드만 반영
                        await setDoc(docRef, newState, { merge: true });
                        lastWriteCompleteTime.current = Date.now();
                    } catch (error) {
                        console.error("Failed to save data to Firestore:", error);
                    } finally {
                        // 실제 쓰기가 완료된 후에도 스냅샷을 잠시 더 차단하기 위해 약간의 지연 후 flag 해제
                        setTimeout(() => {
                            isWriting.current = false;
                        }, 500);
                        writeTimeout.current = null;
                    }
                }, 800); // 데바운스 시간을 약간 줄여 반응성 개선
            }
            return newState;
        });
    }, [userId]);

    return [state, setDebouncedState];
}
