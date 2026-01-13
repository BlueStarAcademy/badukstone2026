
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
    const isFirstLoadRef = useRef<boolean>(true);

    const mergeData = useCallback((incoming: any): T => {
        const initial = getInitialData();
        if (!incoming || typeof incoming !== 'object' || !incoming.students) {
            return initial;
        }

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

    // 1. 초기 로드 및 실시간 구독
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
            isFirstLoadRef.current = false;
            return;
        }

        const docRef = doc(db, 'users', userId);

        const initAndSubscribe = async () => {
            try {
                // [중요] 캐시가 아닌 서버에서 직접 Authoritative 데이터를 먼저 가져옵니다.
                const snap = await getDoc(docRef);
                let initialTruth: T;
                
                if (snap.exists()) {
                    initialTruth = mergeData(snap.data());
                } else {
                    initialTruth = getInitialData();
                    await setDoc(docRef, { ...initialTruth, _updatedAt: Date.now() });
                }

                latestStateRef.current = initialTruth;
                setState(initialTruth);
                isFirstLoadRef.current = false;

                // 이후 실시간 변경사항 구독 시작
                const unsubscribe = onSnapshot(docRef, (docSnap) => {
                    // 로컬에서 저장 중인 경우 서버 스냅샷 무시 (레이스 컨디션 방지)
                    if (docSnap.metadata.hasPendingWrites || isSaving) return;

                    if (docSnap.exists()) {
                        const cloudData = docSnap.data();
                        const merged = mergeData(cloudData);
                        
                        // 데이터가 실제로 다를 때만 업데이트
                        if (JSON.stringify(latestStateRef.current) !== JSON.stringify(merged)) {
                            latestStateRef.current = merged;
                            setState(merged);
                        }
                    }
                });

                return unsubscribe;
            } catch (err) {
                console.error("Firestore Init Error:", err);
                setState('error');
            }
        };

        const subPromise = initAndSubscribe();
        return () => {
            subPromise.then(unsub => unsub?.());
        };
    }, [userId, mergeData]);

    // 2. 상태 변경 및 디바운스 저장
    const setDebouncedState: SetState<T> = useCallback((newStateOrFn) => {
        setState(prevState => {
            if (prevState === 'error' || prevState === null) return prevState;

            const nextState = typeof newStateOrFn === 'function'
                ? (newStateOrFn as any)(prevState)
                : newStateOrFn;

            if (!nextState || nextState === 'error') return nextState;

            latestStateRef.current = nextState;

            if (isDemoMode || !db) {
                if (userId) localStorage.setItem(`demo_data_${userId}`, JSON.stringify(nextState));
                return nextState;
            }

            // 초기 로드가 끝나기 전에는 쓰기를 시도하지 않음 (덮어쓰기 방지)
            if (isFirstLoadRef.current) return nextState;

            setIsSaving(true);
            if (writeTimeout.current) window.clearTimeout(writeTimeout.current);
            
            writeTimeout.current = window.setTimeout(async () => {
                if (!userId || !db) return;
                try {
                    const docRef = doc(db, 'users', userId);
                    // 타임스탬프를 함께 저장하여 최신성 보장
                    await setDoc(docRef, {
                        ...nextState,
                        _updatedAt: Date.now()
                    });
                } catch (e) {
                    console.error("Firestore Save Error:", e);
                } finally {
                    // 저장 완료 후 약간의 유예 시간을 두어 서버 잔상이 UI를 덮지 않게 함
                    setTimeout(() => setIsSaving(false), 500);
                }
                writeTimeout.current = null;
            }, 800);

            return nextState;
        });
    }, [userId]);

    return [state, setDebouncedState, isSaving];
}
