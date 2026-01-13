
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
    
    // 로컬의 최신 상태를 관리하기 위한 Ref (클로저 이슈 방지)
    const latestStateRef = useRef<T | null>(null);
    // 마지막으로 서버에 쓰기를 시작한 데이터의 타임스탬프
    const lastWriteAt = useRef<number>(0);
    const writeTimeout = useRef<number | null>(null);

    // 데이터 병합 함수: 서버 데이터에 신규 필드가 없을 경우 초기값을 보충
    const mergeData = useCallback((incoming: any): T => {
        const initial = getInitialData();
        return {
            ...initial,
            ...incoming,
            // 중첩된 설정 객체들에 대한 병합 보장
            groupSettings: { ...initial.groupSettings, ...(incoming.groupSettings || {}) },
            generalSettings: { ...initial.generalSettings, ...(incoming.generalSettings || {}) },
            eventSettings: { ...initial.eventSettings, ...(incoming.eventSettings || {}) },
            tournamentSettings: { ...initial.tournamentSettings, ...(incoming.tournamentSettings || {}) },
            tournamentData: { ...initial.tournamentData, ...(incoming.tournamentData || {}) },
            shopSettings: { ...initial.shopSettings, ...(incoming.shopSettings || {}) },
            // 배열 데이터 보장
            students: incoming.students || initial.students,
            missions: incoming.missions || initial.missions,
            chessMissions: incoming.chessMissions || initial.chessMissions,
            specialMissions: incoming.specialMissions || initial.specialMissions,
            shopItems: incoming.shopItems || initial.shopItems,
            transactions: incoming.transactions || initial.transactions,
            coupons: incoming.coupons || initial.coupons,
            chessMatches: incoming.chessMatches || initial.chessMatches,
            shopCategories: incoming.shopCategories || initial.shopCategories,
        };
    }, [getInitialData]);

    // 1. 초기 데이터 로드 (컴포넌트 마운트 시 1회)
    useEffect(() => {
        if (!userId) {
            setState(null);
            latestStateRef.current = null;
            return;
        }

        const loadInitial = async () => {
            if (isDemoMode || !db) {
                const saved = localStorage.getItem(`demo_data_${userId}`);
                const data = saved ? mergeData(JSON.parse(saved)) : getInitialData();
                latestStateRef.current = data;
                setState(data);
                return;
            }

            try {
                const docRef = doc(db, 'users', userId);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    const data = mergeData(snap.data());
                    latestStateRef.current = data;
                    setState(data);
                } else {
                    const initial = getInitialData();
                    await setDoc(docRef, initial);
                    latestStateRef.current = initial;
                    setState(initial);
                }
            } catch (e) {
                console.error("Firestore 로드 실패:", e);
                setState('error');
            }
        };

        loadInitial();
    }, [userId, mergeData]);

    // 2. 실시간 스냅샷 구독
    useEffect(() => {
        if (!userId || isDemoMode || !db || state === 'error' || state === null) return;

        const docRef = doc(db, 'users', userId);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            // [중요] 로컬에서 현재 저장 중이거나 대기 중인 쓰기가 있다면 스냅샷 무시
            // docSnap.metadata.hasPendingWrites는 SDK가 인지하는 로컬 쓰기 상태임
            if (docSnap.metadata.hasPendingWrites || isSaving) {
                return;
            }

            if (docSnap.exists()) {
                const cloudData = docSnap.data();
                const cloudUpdatedAt = cloudData._updatedAt || 0;

                // 서버 데이터가 로컬의 최근 저장 시점보다 이전 것이라면 업데이트 거부 (롤백 방지)
                if (cloudUpdatedAt < lastWriteAt.current) {
                    return;
                }

                const merged = mergeData(cloudData);
                
                // 로컬 상태와 서버 데이터가 다를 때만 업데이트하여 불필요한 리렌더링 방지
                if (JSON.stringify(latestStateRef.current) !== JSON.stringify(merged)) {
                    latestStateRef.current = merged;
                    setState(merged);
                }
            }
        }, (err) => {
            console.error("Firestore 구독 에러:", err);
        });

        return () => unsubscribe();
    }, [userId, isSaving, state === null, mergeData]);

    // 3. 실제 저장 수행 함수
    const persist = useCallback(async (data: T) => {
        if (!userId) return;
        
        try {
            if (isDemoMode || !db) {
                localStorage.setItem(`demo_data_${userId}`, JSON.stringify(data));
                return;
            }

            const now = Date.now();
            lastWriteAt.current = now;
            
            const docRef = doc(db, 'users', userId);
            await setDoc(docRef, {
                ...data,
                _updatedAt: now // 서버와 동기화 확인을 위한 타임스탬프
            });
        } catch (e) {
            console.error("Firestore 저장 실패:", e);
            // 에러 시 사용자에게 알림이 필요할 수 있음
        }
    }, [userId]);

    // 4. 상태 변경 핸들러 (디바운스 포함)
    const setDebouncedState: SetState<T> = useCallback((newStateOrFn) => {
        setState(prevState => {
            if (prevState === 'error') return prevState;

            const nextState = typeof newStateOrFn === 'function'
                ? (newStateOrFn as any)(prevState)
                : newStateOrFn;

            if (!nextState || nextState === 'error') return nextState;

            // 로컬 Ref 즉시 업데이트 (UI 응답성)
            latestStateRef.current = nextState;

            // 데모 모드 즉시 저장
            if (isDemoMode || !db) {
                if (userId) localStorage.setItem(`demo_data_${userId}`, JSON.stringify(nextState));
                return nextState;
            }

            // Firestore 저장 예약 (디바운스)
            setIsSaving(true);
            if (writeTimeout.current) window.clearTimeout(writeTimeout.current);
            
            writeTimeout.current = window.setTimeout(async () => {
                await persist(nextState);
                setIsSaving(false);
                writeTimeout.current = null;
            }, 1000); // 1초 디바운스 (안정성 확보)

            return nextState;
        });
    }, [userId, persist]);

    return [state, setDebouncedState, isSaving];
}
