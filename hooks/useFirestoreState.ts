
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
    
    // 로컬의 최신 상태를 추적하기 위한 Ref (클로저 문제 방지)
    const latestStateRef = useRef<T | null>(null);
    // 마지막 로컬 업데이트 시간을 추적 (서버의 낡은 데이터가 덮어쓰는 것 방지)
    const lastLocalUpdateAt = useRef<number>(0);
    const writeTimeout = useRef<number | null>(null);

    // 데이터 병합 헬퍼 함수
    const mergeWithInitial = useCallback((cloudData: any): T => {
        const initial = getInitialData();
        return {
            ...initial,
            ...cloudData,
            // 중첩된 객체/배열들에 대한 보장 (필요한 경우 더 깊은 병합 수행)
            groupSettings: { ...initial.groupSettings, ...(cloudData.groupSettings || {}) },
            generalSettings: { ...initial.generalSettings, ...(cloudData.generalSettings || {}) },
            eventSettings: { ...initial.eventSettings, ...(cloudData.eventSettings || {}) },
            tournamentSettings: { ...initial.tournamentSettings, ...(cloudData.tournamentSettings || {}) },
            tournamentData: { ...initial.tournamentData, ...(cloudData.tournamentData || {}) },
            // 배열 데이터들은 데이터가 있을 때만 덮어쓰고, 없으면 초기값([]) 유지
            students: cloudData.students || initial.students,
            missions: cloudData.missions || initial.missions,
            chessMissions: cloudData.chessMissions || initial.chessMissions,
            specialMissions: cloudData.specialMissions || initial.specialMissions,
            shopItems: cloudData.shopItems || initial.shopItems,
            transactions: cloudData.transactions || initial.transactions,
            coupons: cloudData.coupons || initial.coupons,
            chessMatches: cloudData.chessMatches || initial.chessMatches,
            shopCategories: cloudData.shopCategories || initial.shopCategories,
        };
    }, [getInitialData]);

    // 초기 데이터 로드
    useEffect(() => {
        if (!userId) {
            setState(null);
            return;
        }

        const init = async () => {
            if (isDemoMode || !db) {
                const saved = localStorage.getItem(`demo_data_${userId}`);
                const data = saved ? mergeWithInitial(JSON.parse(saved)) : getInitialData();
                latestStateRef.current = data;
                setState(data);
                return;
            }

            try {
                const docRef = doc(db, 'users', userId);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    const data = mergeWithInitial(snap.data());
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

        init();
    }, [userId, mergeWithInitial]);

    // 실시간 구독 및 서버-클라이언트 동기화
    useEffect(() => {
        if (!userId || isDemoMode || !db || state === 'error' || state === null) return;

        const docRef = doc(db, 'users', userId);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            // 본인이 쓰고 있는 중이면 SDK 내부 처리에 맡김
            if (docSnap.metadata.hasPendingWrites) return;

            if (docSnap.exists()) {
                const rawCloudData = docSnap.data();
                const cloudUpdatedAt = (rawCloudData as any)._updatedAt || 0;

                // 서버 데이터가 로컬의 최근 수정보다 이전의 것이라면 무시
                if (cloudUpdatedAt <= lastLocalUpdateAt.current) {
                    return;
                }

                const mergedCloudData = mergeWithInitial(rawCloudData);
                latestStateRef.current = mergedCloudData;
                setState(mergedCloudData);
            }
        });

        return () => unsubscribe();
    }, [userId, state === null, mergeWithInitial]);

    // Firestore에 실제로 데이터를 쓰는 함수
    const flushToFirestore = useCallback(async () => {
        if (!userId || isDemoMode || !db || !latestStateRef.current) return;
        
        try {
            const docRef = doc(db, 'users', userId);
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

    // 화면 종료 전 미저장 데이터 강제 저장
    useEffect(() => {
        const handleBeforeUnload = () => {
            if (isSaving) flushToFirestore();
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isSaving, flushToFirestore]);

    // 상태 변경 및 디바운스 저장 로직
    const setDebouncedState: SetState<T> = useCallback((newStateOrFn) => {
        setState(prevState => {
            const nextState = typeof newStateOrFn === 'function'
                ? (newStateOrFn as any)(prevState)
                : newStateOrFn;

            if (!nextState || nextState === 'error' || !userId) return nextState;

            // 1. 즉시 최신 상태 반영 (UI 응답성)
            latestStateRef.current = nextState;
            lastLocalUpdateAt.current = Date.now();

            // 데모 모드 저장
            if (isDemoMode || !db) {
                localStorage.setItem(`demo_data_${userId}`, JSON.stringify(nextState));
                return nextState;
            }

            // 2. 디바운스 저장 예약 (네트워크 부하 감소)
            setIsSaving(true);
            if (writeTimeout.current) window.clearTimeout(writeTimeout.current);
            
            writeTimeout.current = window.setTimeout(async () => {
                await flushToFirestore();
                setIsSaving(false);
                writeTimeout.current = null;
            }, 800); // 0.8초 대기 후 저장

            return nextState;
        });
    }, [userId, flushToFirestore]);

    return [state, setDebouncedState, isSaving];
}
