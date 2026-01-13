
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
    
    // 로컬에서의 마지막 수정 시간 추적
    const lastLocalUpdateAt = useRef<number>(0);
    // 서버 데이터 로드 완료 여부
    const isInitialized = useRef<boolean>(false);
    const writeTimeout = useRef<number | null>(null);

    const mergeData = useCallback((incoming: any): T => {
        const initial = getInitialData();
        if (!incoming || typeof incoming !== 'object' || !incoming.students) return initial;

        return {
            ...initial,
            ...incoming,
            groupSettings: { ...initial.groupSettings, ...(incoming.groupSettings || {}) },
            generalSettings: { ...initial.generalSettings, ...(incoming.generalSettings || {}) },
            eventSettings: { ...initial.eventSettings, ...(incoming.eventSettings || {}) },
            tournamentSettings: { ...initial.tournamentSettings, ...(incoming.tournamentSettings || {}) },
            tournamentData: { ...initial.tournamentData, ...(incoming.tournamentData || {}) },
            shopSettings: { ...initial.shopSettings, ...(incoming.shopSettings || {}) },
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

    // 1. 서버 데이터 실시간 리스너
    useEffect(() => {
        if (!userId) {
            setState(null);
            return;
        }

        if (isDemoMode || !db) {
            const saved = localStorage.getItem(`demo_data_${userId}`);
            setState(saved ? mergeData(JSON.parse(saved)) : getInitialData());
            isInitialized.current = true;
            return;
        }

        const docRef = doc(db, 'users', userId);
        
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (!docSnap.exists()) {
                // 문서가 없으면 초기 데이터 생성 (최초 1회만)
                if (!isInitialized.current) {
                    const initial = getInitialData();
                    setDoc(docRef, { ...initial, _updatedAt: Date.now() });
                    setState(initial);
                    isInitialized.current = true;
                }
                return;
            }

            const cloudData = docSnap.data();
            const cloudUpdatedAt = cloudData._updatedAt || 0;

            // [핵심] 서버에서 온 데이터가 내가 로컬에서 마지막으로 고친 시간보다 옛날 것이라면 무시
            if (cloudUpdatedAt < lastLocalUpdateAt.current) {
                console.log("Ignored stale server update (Rollback prevented)");
                return;
            }

            // 로컬 수정 중이 아닐 때만 상태 업데이트
            if (!docSnap.metadata.hasPendingWrites) {
                setState(mergeData(cloudData));
                isInitialized.current = true;
            }
        });

        return () => unsubscribe();
    }, [userId, mergeData]);

    // 2. 상태 변경 핸들러
    const setDebouncedState: SetState<T> = useCallback((newStateOrFn) => {
        setState(prevState => {
            if (prevState === 'error' || prevState === null) return prevState;

            const nextState = typeof newStateOrFn === 'function'
                ? (newStateOrFn as any)(prevState)
                : newStateOrFn;

            if (!nextState || nextState === 'error') return nextState;

            // 로컬 타임스탬프 갱신 (서버 데이터 차단 락 활성화)
            const now = Date.now();
            lastLocalUpdateAt.current = now;

            if (isDemoMode || !db) {
                if (userId) localStorage.setItem(`demo_data_${userId}`, JSON.stringify(nextState));
                return nextState;
            }

            // 초기 로드가 안 되었으면 쓰기 금지
            if (!isInitialized.current) return nextState;

            setIsSaving(true);
            if (writeTimeout.current) window.clearTimeout(writeTimeout.current);
            
            writeTimeout.current = window.setTimeout(async () => {
                if (!userId || !db) return;
                try {
                    const docRef = doc(db, 'users', userId);
                    // 타임스탬프를 포함하여 저장
                    await setDoc(docRef, {
                        ...nextState,
                        _updatedAt: now // 상태 변경이 일어났던 바로 그 시간 기록
                    });
                } catch (e) {
                    console.error("Firestore Save Error:", e);
                } finally {
                    setIsSaving(false);
                }
                writeTimeout.current = null;
            }, 800);

            return nextState;
        });
    }, [userId]);

    return [state, setDebouncedState, isSaving];
}
