
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { doc, setDoc, onSnapshot, getDoc, type DocumentSnapshot } from 'firebase/firestore';
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
    
    // 이 플래그는 업데이트가 "서버(onSnapshot)"에서 왔는지 "사용자(setState)"에서 왔는지 구분합니다.
    const isLocalUpdate = useRef<boolean>(false);
    // 최초 서버 데이터 로드 여부
    const hasInitialized = useRef<boolean>(false);

    const mergeData = useCallback((incoming: any): T => {
        const initial = getInitialData();
        if (!incoming) return initial;

        return {
            ...initial,
            ...incoming,
            groupSettings: { ...initial.groupSettings, ...(incoming.groupSettings || {}) },
            generalSettings: { ...initial.generalSettings, ...(incoming.generalSettings || {}) },
            eventSettings: { ...initial.eventSettings, ...(incoming.eventSettings || {}) },
            tournamentSettings: { ...initial.tournamentSettings, ...(incoming.tournamentSettings || {}) },
            tournamentData: { ...initial.tournamentData, ...(incoming.tournamentData || {}) },
            shopSettings: { ...initial.shopSettings, ...(incoming.shopSettings || {}) },
            // 필드가 아예 없는 경우에만 초기 배열 사용
            students: incoming.students !== undefined ? incoming.students : initial.students,
            missions: incoming.missions !== undefined ? incoming.missions : initial.missions,
            chessMissions: incoming.chessMissions !== undefined ? incoming.chessMissions : initial.chessMissions,
            specialMissions: incoming.specialMissions !== undefined ? incoming.specialMissions : initial.specialMissions,
            shopItems: incoming.shopItems !== undefined ? incoming.shopItems : initial.shopItems,
            transactions: incoming.transactions !== undefined ? incoming.transactions : initial.transactions,
            coupons: incoming.coupons !== undefined ? incoming.coupons : initial.coupons,
            chessMatches: incoming.chessMatches !== undefined ? incoming.chessMatches : initial.chessMatches,
            shopCategories: incoming.shopCategories !== undefined ? incoming.shopCategories : initial.shopCategories,
        };
    }, [getInitialData]);

    // 1. 실시간 동기화 및 초기 로드
    useEffect(() => {
        if (!userId) {
            setState(null);
            return;
        }

        if (isDemoMode || !db) {
            const saved = localStorage.getItem(`demo_data_${userId}`);
            const data = saved ? mergeData(JSON.parse(saved)) : getInitialData();
            latestStateRef.current = data;
            setState(data);
            hasInitialized.current = true;
            return;
        }

        const docRef = doc(db, 'users', userId);
        
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            // 본인이 작성 중인 데이터면 무시 (SDK가 알아서 처리)
            if (docSnap.metadata.hasPendingWrites) return;

            // 네트워크가 연결되어 있는데 캐시 데이터가 오면 무시 (어제의 데이터 방지)
            if (docSnap.metadata.fromCache && navigator.onLine && hasInitialized.current) {
                console.log("Firestore: Stale cache ignored.");
                return;
            }

            if (docSnap.exists()) {
                const cloudData = docSnap.data();
                const merged = mergeData(cloudData);
                
                // 중요: 서버 데이터로 상태를 업데이트할 때는 '로컬 수정 플래그'를 끕니다.
                isLocalUpdate.current = false;
                latestStateRef.current = merged;
                setState(merged);
                hasInitialized.current = true;
            } else {
                // 문서가 아예 없으면 초기 데이터 생성
                const initial = getInitialData();
                setDoc(docRef, { ...initial, _updatedAt: Date.now() });
                latestStateRef.current = initial;
                setState(initial);
                hasInitialized.current = true;
            }
        }, (err) => {
            console.error("Firestore Sync Error:", err);
            setState('error');
        });

        return () => unsubscribe();
    }, [userId, mergeData]);

    // 2. 실제 Firestore 쓰기 로직
    const persist = useCallback(async (data: T) => {
        if (!userId || !db || isDemoMode) return;
        
        try {
            const docRef = doc(db, 'users', userId);
            await setDoc(docRef, {
                ...data,
                _updatedAt: Date.now()
            });
        } catch (e) {
            console.error("Firestore Save Error:", e);
        }
    }, [userId]);

    // 3. 상태 변경 핸들러
    const setDebouncedState: SetState<T> = useCallback((newStateOrFn) => {
        setState(prevState => {
            if (prevState === 'error') return prevState;

            const nextState = typeof newStateOrFn === 'function'
                ? (newStateOrFn as any)(prevState)
                : newStateOrFn;

            if (!nextState || nextState === 'error') return nextState;

            // 최신 Ref 즉시 업데이트
            latestStateRef.current = nextState;
            
            // 로컬 수동 업데이트임을 표시
            isLocalUpdate.current = true;

            // 데모 모드
            if (isDemoMode || !db) {
                if (userId) localStorage.setItem(`demo_data_${userId}`, JSON.stringify(nextState));
                return nextState;
            }

            // 아직 서버 데이터를 한 번도 못 받았다면 쓰기 예약 방지 (덮어쓰기 방지)
            if (!hasInitialized.current) return nextState;

            // Firestore 저장 예약 (디바운스)
            setIsSaving(true);
            if (writeTimeout.current) window.clearTimeout(writeTimeout.current);
            
            writeTimeout.current = window.setTimeout(async () => {
                // 저장 실행 직전에 마지막으로 플래그 확인
                if (isLocalUpdate.current) {
                    await persist(nextState);
                }
                setIsSaving(false);
                writeTimeout.current = null;
            }, 1000); 

            return nextState;
        });
    }, [userId, persist]);

    return [state, setDebouncedState, isSaving];
}
