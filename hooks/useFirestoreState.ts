
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
    
    // 로컬 상태 참조 (최신성 유지)
    const latestStateRef = useRef<T | null>(null);
    // 서버에 쓰기가 진행 중이거나 대기 중인 상태를 추적
    const editLockRef = useRef<boolean>(false);
    const writeTimeout = useRef<number | null>(null);
    const hasInitialized = useRef<boolean>(false);

    const mergeData = useCallback((incoming: any): T => {
        const initial = getInitialData();
        // 데이터가 유효하지 않으면 초기값 반환
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

    // 1. 초기 데이터 및 실시간 동기화
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
            // [핵심] 로컬에서 편집 중(editLockRef)이라면 서버 데이터를 무시합니다.
            // 이렇게 해야 눈앞에서 데이터가 롤백되는 현상을 막을 수 있습니다.
            if (editLockRef.current) {
                return;
            }

            // 본인이 작성 중인 데이터면 SDK 레벨에서 무시됨
            if (docSnap.metadata.hasPendingWrites) return;

            if (docSnap.exists()) {
                const cloudData = docSnap.data();
                const merged = mergeData(cloudData);
                
                // 로컬 데이터와 서버 데이터가 같으면 업데이트 안 함 (무한 루프 방지)
                const currentStr = JSON.stringify(latestStateRef.current);
                const mergedStr = JSON.stringify(merged);
                
                if (currentStr !== mergedStr) {
                    latestStateRef.current = merged;
                    setState(merged);
                }
                hasInitialized.current = true;
            } else {
                // 문서가 아예 없는 경우에만 초기 생성
                if (!hasInitialized.current) {
                    const initial = getInitialData();
                    setDoc(docRef, { ...initial, _updatedAt: Date.now() });
                    latestStateRef.current = initial;
                    setState(initial);
                    hasInitialized.current = true;
                }
            }
        }, (err) => {
            console.error("Firestore Sync Error:", err);
            setState('error');
        });

        return () => unsubscribe();
    }, [userId, mergeData]);

    // 2. 상태 변경 핸들러
    const setDebouncedState: SetState<T> = useCallback((newStateOrFn) => {
        setState(prevState => {
            if (prevState === 'error') return prevState;

            const nextState = typeof newStateOrFn === 'function'
                ? (newStateOrFn as any)(prevState)
                : newStateOrFn;

            if (!nextState || nextState === 'error') return nextState;

            // 로컬 상태 즉시 갱신 및 락(Lock) 활성화
            latestStateRef.current = nextState;
            editLockRef.current = true; // 서버 업데이트 차단 시작

            // 데모 모드 처리
            if (isDemoMode || !db) {
                if (userId) localStorage.setItem(`demo_data_${userId}`, JSON.stringify(nextState));
                // 데모는 락을 걸 필요가 없으므로 즉시 해제
                editLockRef.current = false;
                return nextState;
            }

            // 아직 서버 로드가 안 된 상태라면 저장을 잠시 보류 (덮어쓰기 방지)
            if (!hasInitialized.current) return nextState;

            // 디바운스 저장
            setIsSaving(true);
            if (writeTimeout.current) window.clearTimeout(writeTimeout.current);
            
            writeTimeout.current = window.setTimeout(async () => {
                if (!userId || !db) return;
                
                try {
                    const docRef = doc(db, 'users', userId);
                    await setDoc(docRef, {
                        ...nextState,
                        _updatedAt: Date.now()
                    });
                    
                    // [중요] 저장이 끝난 후에도 즉시 락을 풀지 않고 0.5초 더 대기합니다.
                    // 서버 응답이 지연되어 낡은 스냅샷이 올 수 있기 때문입니다.
                    setTimeout(() => {
                        editLockRef.current = false;
                        setIsSaving(false);
                    }, 500);
                    
                } catch (e) {
                    console.error("Firestore Save Error:", e);
                    editLockRef.current = false;
                    setIsSaving(false);
                }
                
                writeTimeout.current = null;
            }, 800); // 0.8초 대기 후 저장

            return nextState;
        });
    }, [userId]);

    return [state, setDebouncedState, isSaving];
}
