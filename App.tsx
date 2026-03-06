
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, firebaseError, isDemoMode } from './firebase';
import { useFirestoreState } from './hooks/useFirestoreState';
import { INITIAL_STUDENTS, INITIAL_MISSIONS, INITIAL_SHOP_ITEMS, INITIAL_GROUP_SETTINGS, INITIAL_GENERAL_SETTINGS, INITIAL_EVENT_SETTINGS, INITIAL_TOURNAMENT_DATA, INITIAL_TOURNAMENT_SETTINGS, INITIAL_SHOP_CATEGORIES, INITIAL_GACHA_STATES, INITIAL_CHESS_MISSIONS, INITIAL_SPECIAL_MISSIONS } from './data/initialData';
import type { Student, Mission, ShopItem, View, Transaction, Coupon, GroupSettings, AppData, UsedCouponInfo, ChessMatch, User, MasterData, GachaData, SpecialMission, EventSettings, EventMonthlyStats, IndividualMissionSeries, StudentMissionProgress } from './types';
import { generateId, getGroupForRank } from './utils';
import { calculateNewElo } from './utils/elo';

import { StudentView } from './components/StudentView';
import { AdminPanel } from './components/AdminPanel';
import { QuickMenuSidebar } from './components/QuickMenuSidebar';
import { EventView } from './components/EventView';
import { TournamentView } from './components/tournament/TournamentView';
import { ChessPanel } from './components/chess/ChessPanel';
import { LoginPage } from './components/LoginPage';
import { MasterPanel } from './components/MasterPanel';
import { AccountSettingsModal } from './components/modals/SettingsModal';

const MAX_TRANSACTIONS = 1000;
const MAX_CHESS_MATCHES = 500;

function getMonthKey(timestamp: string): string {
    const d = new Date(timestamp);
    return `${d.getFullYear()}-${d.getMonth()}`;
}

function applyEventMonthlyStatsDelta(
    prev: EventMonthlyStats | undefined,
    monthKey: string,
    studentId: string,
    delta: { missions?: number; penalties?: number },
    baseFromTx?: { missions?: number; penalties?: number }
): EventMonthlyStats {
    const next: EventMonthlyStats = { ...(prev || {}) };
    if (!next[monthKey]) next[monthKey] = {};
    const month = { ...next[monthKey] };
    const student = month[studentId] || { missions: 0, penalties: 0 };
    const baseMissions = baseFromTx?.missions ?? student.missions ?? 0;
    const basePenalties = baseFromTx?.penalties ?? student.penalties ?? 0;
    month[studentId] = {
        missions: Math.max(0, baseMissions + (delta.missions ?? 0)),
        penalties: Math.max(0, basePenalties + (delta.penalties ?? 0)),
        ...(student.participated !== undefined && { participated: student.participated }),
    };
    next[monthKey] = month;
    return next;
}

/** 이벤트 참여 여부만 설정 (트랜잭션 압축 시에도 참여 완료 유지) */
function setEventParticipated(prev: EventMonthlyStats | undefined, monthKey: string, studentId: string, value: boolean): EventMonthlyStats {
    const next: EventMonthlyStats = { ...(prev || {}) };
    if (!next[monthKey]) next[monthKey] = {};
    const month = { ...next[monthKey] };
    const student = month[studentId] || { missions: 0, penalties: 0 };
    month[studentId] = { ...student, participated: value };
    next[monthKey] = month;
    return next;
}

function countMonthMissionPenaltyFromTx(transactions: Transaction[], monthKey: string, studentId: string): { missions: number; penalties: number } {
    const [y, m] = monthKey.split('-').map(Number);
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0, 23, 59, 59);
    const missions = transactions.filter(t =>
        t.studentId === studentId &&
        (t.type === 'mission' || t.type === 'attendance' || t.type === 'special_mission' || t.type === 'mission_adjustment') &&
        t.status === 'active' &&
        new Date(t.timestamp) >= start &&
        new Date(t.timestamp) <= end
    ).reduce((acc, t) => acc + (t.type === 'mission_adjustment' ? (t.missionCountDelta || 0) : 1), 0);
    const penalties = transactions.filter(t =>
        t.studentId === studentId &&
        t.type === 'penalty' &&
        new Date(t.timestamp) >= start &&
        new Date(t.timestamp) <= end
    ).length;
    return { missions, penalties };
}

const getInitialData = (): AppData => ({
    groupSettings: INITIAL_GROUP_SETTINGS,
    generalSettings: INITIAL_GENERAL_SETTINGS,
    eventSettings: INITIAL_EVENT_SETTINGS,
    tournamentSettings: INITIAL_TOURNAMENT_SETTINGS,
    shopSettings: { bulkPurchaseDiscountRate: 0 },
    students: INITIAL_STUDENTS,
    missions: INITIAL_MISSIONS,
    chessMissions: INITIAL_CHESS_MISSIONS,
    specialMissions: INITIAL_SPECIAL_MISSIONS,
    shopItems: INITIAL_SHOP_ITEMS,
    transactions: [],
    coupons: [],
    shopCategories: INITIAL_SHOP_CATEGORIES,
    chessMatches: [],
    gachaState: INITIAL_GACHA_STATES,
    tournamentData: { ...INITIAL_TOURNAMENT_DATA, participantIds: [], teams: [{ name: 'A', players: [], mannerPenalties: 0 }, { name: 'B', players: [], mannerPenalties: 0 }] },
    lastBirthdayCouponMonth: null,
    individualMissionSeries: [],
    studentMissionProgress: {},
    eventMonthlyStats: {},
    personalMissions: {},
});

const AppLoader = ({ message, showLogout, onLogout }: { message: string, showLogout?: boolean, onLogout?: () => void }) => (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw', fontSize: '1.2rem', background: 'var(--bg-color)', color: 'var(--secondary-color)' }}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{ marginBottom: '1rem', fontSize: '2.5rem' }}>💎</div>
            <div style={{ marginBottom: '1.5rem' }}>{message}</div>
            {showLogout && onLogout && (
                <button className="btn primary" onClick={onLogout}>다시 로그인하기</button>
            )}
        </div>
    </div>
);

export const App = () => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [useDemo, setUseDemo] = useState(false);

    useEffect(() => {
        if (isDemoMode || !auth) {
            setAuthLoading(false);
            return;
        }
        
        const unsubscribe = onAuthStateChanged(auth, user => {
            setCurrentUser(user ? { uid: user.uid, email: user.email } : null);
            setAuthLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleLogout = () => {
        if (auth && !isDemoMode) auth.signOut().catch(e => console.error(e));
        setCurrentUser(null);
        setUseDemo(false);
    };

    const handleDemoLogin = () => {
        setUseDemo(true);
        setCurrentUser({ uid: 'demo_user', email: 'demo@example.com' });
    };

    if (authLoading) return <AppLoader message="로그인 정보 확인 중..." />;

    if (!currentUser && !useDemo) {
        return <LoginPage 
            onLoginSuccess={(role) => {
                if (role === 'master') {
                    setCurrentUser({ uid: 'master', email: 'bsbaduk' });
                }
            }} 
            isDemoMode={isDemoMode}
            onDemoClick={handleDemoLogin}
        />;
    }
    
    return <MainApp user={currentUser!} onLogout={handleLogout} isDemo={useDemo || isDemoMode} />;
};

interface MainAppProps {
    user: User;
    onLogout: () => void;
    isDemo: boolean;
}

const MainApp = ({ user, onLogout, isDemo }: MainAppProps) => {
    // FIX: useFirestoreState hook now returns saveError as the 4th element
    const [appState, setAppState, isSaving, saveError] = useFirestoreState<AppData>(user.uid, getInitialData);

    const [view, setView] = useState<View>('student');
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    /** 지난달 이벤트 버튼으로 진입 시 EventView에서 '지난 달' 탭 자동 선택 */
    const [eventOpenForMonth, setEventOpenForMonth] = useState<'current' | 'previous' | null>(null);

    const students = useMemo(() => (appState && appState !== 'error') ? appState.students || [] : [], [appState]);
    const transactions = useMemo(() => (appState && appState !== 'error') ? appState.transactions || [] : [], [appState]);
    const coupons = useMemo(() => (appState && appState !== 'error') ? appState.coupons || [] : [], [appState]);
    const missions = useMemo(() => (appState && appState !== 'error') ? appState.missions || [] : [], [appState]);
    const chessMissions = useMemo(() => (appState && appState !== 'error') ? appState.chessMissions || [] : [], [appState]);
    const specialMissions = useMemo(() => (appState && appState !== 'error') ? appState.specialMissions || [] : [], [appState]);
    const shopCategories = useMemo(() => (appState && appState !== 'error') ? appState.shopCategories || INITIAL_SHOP_CATEGORIES : INITIAL_SHOP_CATEGORIES, [appState]);
    const shopItems = useMemo(() => (appState && appState !== 'error') ? appState.shopItems || [] : [], [appState]);
    
    const groupSettings = (appState && appState !== 'error') ? appState.groupSettings || INITIAL_GROUP_SETTINGS : INITIAL_GROUP_SETTINGS;
    const generalSettings = (appState && appState !== 'error') ? appState.generalSettings || INITIAL_GENERAL_SETTINGS : INITIAL_GENERAL_SETTINGS;
    const eventSettings = (appState && appState !== 'error') ? appState.eventSettings || INITIAL_EVENT_SETTINGS : INITIAL_EVENT_SETTINGS;
    const shopSettings = (appState && appState !== 'error') ? appState.shopSettings || { bulkPurchaseDiscountRate: 0 } : { bulkPurchaseDiscountRate: 0 };
    const tournamentData = (appState && appState !== 'error') ? appState.tournamentData || { ...INITIAL_TOURNAMENT_DATA, teams: [{ name: 'A', players: [], mannerPenalties: 0 }, { name: 'B', players: [], mannerPenalties: 0 }] } : { ...INITIAL_TOURNAMENT_DATA, teams: [{ name: 'A', players: [], mannerPenalties: 0 }, { name: 'B', players: [], mannerPenalties: 0 }] };
    const tournamentSettings = (appState && appState !== 'error') ? appState.tournamentSettings || INITIAL_TOURNAMENT_SETTINGS : INITIAL_TOURNAMENT_SETTINGS;
    const chessMatches = (appState && appState !== 'error') ? appState.chessMatches || [] : [];
    const gachaState = (appState && appState !== 'error') ? appState.gachaState || INITIAL_GACHA_STATES : INITIAL_GACHA_STATES;
    const eventMonthlyStats = (appState && appState !== 'error') ? appState.eventMonthlyStats : undefined;
    const personalMissions = (appState && appState !== 'error') ? (appState.personalMissions || {}) : {};
    const individualMissionSeries = (appState && appState !== 'error') ? appState.individualMissionSeries || [] : [];
    const studentMissionProgress = (appState && appState !== 'error') ? appState.studentMissionProgress || {} : {};

    const freshSelectedStudent = useMemo(() => {
        if (!selectedStudent) return null;
        return students.find(s => s.id === selectedStudent.id) || null;
    }, [students, selectedStudent]);

    useEffect(() => {
        if (!appState || appState === 'error') return;

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1; 

        if (appState.lastBirthdayCouponMonth === currentMonth) return;

        const birthdayStudents = appState.students.filter(s => {
            if (!s.birthday || s.status !== '재원') return false;
            const bMonth = parseInt(s.birthday.split('-')[0], 10);
            return bMonth === currentMonth;
        });

        if (birthdayStudents.length > 0) {
            const lastDay = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);
            const expiresAt = lastDay.toISOString();
            
            const newCoupons: Coupon[] = birthdayStudents.map(s => ({
                id: generateId(),
                studentId: s.id,
                description: `${currentMonth}월 생일 축하 쿠폰 🎂`,
                value: generalSettings.birthdayCouponValue || 300,
                expiresAt
            }));

            setAppState(prev => {
                if (!prev || prev === 'error') return prev;
                return {
                    ...prev,
                    coupons: [...prev.coupons, ...newCoupons],
                    lastBirthdayCouponMonth: currentMonth
                };
            });
        } else {
            setAppState(prev => {
                if (!prev || prev === 'error') return prev;
                return { ...prev, lastBirthdayCouponMonth: currentMonth };
            });
        }
    }, [appState, setAppState, generalSettings.birthdayCouponValue]);

    const handleAddTransaction = useCallback((studentId: string, type: Transaction['type'], description: string, amount: number, eventDetails?: { eventMonth: string }) => {
        setAppState(prev => {
            if (prev === 'error' || !prev) return prev;
            
            const studentIdx = prev.students.findIndex(s => s.id === studentId);
            if (studentIdx === -1) return prev;

            const student = prev.students[studentIdx];
            const currentStones = student.stones || 0;
            const maxStones = student.maxStones || 50;
            const newStones = Math.max(0, Math.min(maxStones, currentStones + amount));

            const transaction: Transaction = {
                id: generateId(),
                studentId,
                type,
                description,
                amount,
                timestamp: new Date().toISOString(),
                status: 'active',
                stoneBalanceBefore: currentStones,
                stoneBalanceAfter: newStones,
                ...eventDetails
            };

            const updatedStudents = [...prev.students];
            updatedStudents[studentIdx] = { ...student, stones: newStones };

            const updatedTransactions = [transaction, ...prev.transactions].slice(0, MAX_TRANSACTIONS);

            let newEventMonthlyStats = prev.eventMonthlyStats;
            const monthKey = getMonthKey(transaction.timestamp);
            const baseFromTx = countMonthMissionPenaltyFromTx(prev.transactions, monthKey, studentId);
            if (type === 'mission' || type === 'attendance' || type === 'special_mission') {
                newEventMonthlyStats = applyEventMonthlyStatsDelta(prev.eventMonthlyStats, monthKey, studentId, { missions: 1 }, baseFromTx);
            } else if (type === 'penalty') {
                newEventMonthlyStats = applyEventMonthlyStatsDelta(prev.eventMonthlyStats, monthKey, studentId, { penalties: 1 }, baseFromTx);
            }

            return { 
                ...prev, 
                students: updatedStudents, 
                transactions: updatedTransactions,
                ...(newEventMonthlyStats !== prev.eventMonthlyStats && { eventMonthlyStats: newEventMonthlyStats }),
            };
        });
    }, [setAppState]);

    const handleAdjustMissionCount = useCallback((studentId: string, delta: number) => {
        setAppState(prev => {
            if (prev === 'error' || !prev) return prev;
            
            const studentIdx = prev.students.findIndex(s => s.id === studentId);
            if (studentIdx === -1) return prev;

            const student = prev.students[studentIdx];
            const timestamp = new Date().toISOString();
            
            // 미션 횟수만 조정하고 스톤은 0으로 기록하는 트랜잭션 생성
            const transaction: Transaction = {
                id: generateId(),
                studentId,
                type: 'mission_adjustment',
                description: `미션 횟수 보정 (${delta > 0 ? '+' : ''}${delta})`,
                amount: 0,
                timestamp,
                status: 'active',
                stoneBalanceBefore: student.stones,
                stoneBalanceAfter: student.stones,
                missionCountDelta: delta
            };

            const updatedTransactions = [transaction, ...prev.transactions].slice(0, MAX_TRANSACTIONS);
            const monthKey = getMonthKey(timestamp);
            const baseFromTx = countMonthMissionPenaltyFromTx(prev.transactions, monthKey, studentId);
            const newEventMonthlyStats = applyEventMonthlyStatsDelta(prev.eventMonthlyStats, monthKey, studentId, { missions: delta }, baseFromTx);

            return { 
                ...prev, 
                transactions: updatedTransactions,
                eventMonthlyStats: newEventMonthlyStats,
            };
        });
    }, [setAppState]);

    const handleAssignIndividualMission = useCallback((studentId: string, seriesId: string, currentStepIndex: number) => {
        setAppState(prev => {
            if (prev === 'error' || !prev) return prev;
            const next = { ...prev, studentMissionProgress: { ...prev.studentMissionProgress, [studentId]: { missionSeriesId: seriesId, currentStepIndex } } };
            return next;
        });
    }, [setAppState]);

    const handleUnassignIndividualMission = useCallback((studentId: string) => {
        setAppState(prev => {
            if (prev === 'error' || !prev) return prev;
            const nextProgress = { ...prev.studentMissionProgress };
            delete nextProgress[studentId];
            return { ...prev, studentMissionProgress: nextProgress };
        });
    }, [setAppState]);

    const handleCompleteIndividualStep = useCallback((studentId: string, amount: number) => {
        setAppState(prev => {
            if (prev === 'error' || !prev) return prev;
            const progress = prev.studentMissionProgress[studentId];
            if (!progress) return prev;
            const series = prev.individualMissionSeries?.find(s => s.id === progress.missionSeriesId);
            if (!series || !series.steps[progress.currentStepIndex]) return prev;

            const step = series.steps[progress.currentStepIndex];
            const studentIdx = prev.students.findIndex(s => s.id === studentId);
            if (studentIdx === -1) return prev;
            const student = prev.students[studentIdx];
            const giveStones = Math.max(0, amount);
            const newStones = Math.min(student.maxStones, (student.stones || 0) + giveStones);

            const transaction: Transaction = {
                id: generateId(),
                studentId,
                type: 'mission',
                description: `[개인] ${series.name} - ${step.description}`,
                amount: giveStones,
                timestamp: new Date().toISOString(),
                status: 'active',
                stoneBalanceBefore: student.stones,
                stoneBalanceAfter: newStones
            };

            const updatedStudents = prev.students.map(s => s.id === studentId ? { ...s, stones: newStones } : s);
            const updatedTransactions = [transaction, ...prev.transactions].slice(0, MAX_TRANSACTIONS);

            const nextStepIndex = progress.currentStepIndex + 1;
            const isLastStep = nextStepIndex >= series.steps.length;
            const nextProgress = { ...prev.studentMissionProgress };
            if (isLastStep) delete nextProgress[studentId];
            else nextProgress[studentId] = { missionSeriesId: series.id, currentStepIndex: nextStepIndex };

            const monthKey = getMonthKey(transaction.timestamp);
            const baseFromTx = countMonthMissionPenaltyFromTx(prev.transactions, monthKey, studentId);
            const newEventMonthlyStats = applyEventMonthlyStatsDelta(prev.eventMonthlyStats, monthKey, studentId, { missions: 1 }, baseFromTx);

            return {
                ...prev,
                students: updatedStudents,
                transactions: updatedTransactions,
                studentMissionProgress: nextProgress,
                eventMonthlyStats: newEventMonthlyStats
            };
        });
    }, [setAppState]);

    const handleAddPersonalMission = useCallback((studentId: string, mission: { title: string; stones: number; no: number; missionType?: 'continuous' | 'achievement' }) => {
        setAppState(prev => {
            if (!prev || prev === 'error') return prev;
            const existing = prev.personalMissions || {};
            const list = existing[studentId] || [];
            const newMission = {
                id: generateId(),
                ownerStudentId: studentId,
                title: mission.title,
                stones: mission.stones,
                no: mission.no,
                missionType: mission.missionType || 'continuous',
            };
            return {
                ...prev,
                personalMissions: {
                    ...existing,
                    [studentId]: [...list, newMission],
                },
            };
        });
    }, [setAppState]);

    const handleUpdatePersonalMissionScore = useCallback((studentId: string, missionId: string, newStones: number) => {
        setAppState(prev => {
            if (!prev || prev === 'error') return prev;
            const existing = prev.personalMissions || {};
            const list = existing[studentId] || [];
            const updated = list.map(m => m.id === missionId ? { ...m, stones: newStones } : m);
            return {
                ...prev,
                personalMissions: {
                    ...existing,
                    [studentId]: updated,
                },
            };
        });
    }, [setAppState]);

    const handleUpdatePersonalMission = useCallback((studentId: string, missionId: string, payload: { title?: string; stones?: number; no?: number; missionType?: 'continuous' | 'achievement' }) => {
        setAppState(prev => {
            if (!prev || prev === 'error') return prev;
            const existing = prev.personalMissions || {};
            const list = existing[studentId] || [];
            const updated = list.map(m => m.id === missionId ? { ...m, ...payload } : m);
            return {
                ...prev,
                personalMissions: {
                    ...existing,
                    [studentId]: updated,
                },
            };
        });
    }, [setAppState]);

    const handleDeletePersonalMission = useCallback((studentId: string, missionId: string) => {
        setAppState(prev => {
            if (!prev || prev === 'error') return prev;
            const existing = prev.personalMissions || {};
            const list = (existing[studentId] || []).filter(m => m.id !== missionId);
            return {
                ...prev,
                personalMissions: {
                    ...existing,
                    [studentId]: list,
                },
            };
        });
    }, [setAppState]);

    const handleReorderPersonalMissions = useCallback((studentId: string, orderedMissionIds: string[]) => {
        setAppState(prev => {
            if (!prev || prev === 'error') return prev;
            const existing = prev.personalMissions || {};
            const list = existing[studentId] || [];
            const byId = new Map(list.map(m => [m.id, m]));
            const ordered = orderedMissionIds.map(id => byId.get(id)).filter(Boolean) as typeof list;
            if (ordered.length !== list.length) return prev;
            return {
                ...prev,
                personalMissions: {
                    ...existing,
                    [studentId]: ordered,
                },
            };
        });
    }, [setAppState]);

    const handleCompletePersonalMission = useCallback((studentId: string, missionId: string) => {
        setAppState(prev => {
            if (!prev || prev === 'error') return prev;
            const existing = prev.personalMissions || {};
            const list = existing[studentId] || [];
            const mission = list.find(m => m.id === missionId);
            if (!mission) return prev;
            if ((mission.missionType || 'continuous') === 'achievement' && mission.completedAt) return prev;

            const student = prev.students.find(s => s.id === studentId);
            if (!student) return prev;

            const give = Math.max(0, mission.stones);
            if (give === 0) return prev;

            const newStones = Math.min(student.maxStones, (student.stones || 0) + give);
            const timestamp = new Date().toISOString();

            const transaction: Transaction = {
                id: generateId(),
                studentId,
                type: 'mission',
                description: `[개인] ${mission.title}`,
                amount: give,
                timestamp,
                status: 'active',
                stoneBalanceBefore: student.stones,
                stoneBalanceAfter: newStones,
            };

            const updatedStudents = prev.students.map(s => s.id === studentId ? { ...s, stones: newStones } : s);
            const updatedTransactions = [transaction, ...prev.transactions].slice(0, MAX_TRANSACTIONS);

            const monthKey = getMonthKey(timestamp);
            const baseFromTx = countMonthMissionPenaltyFromTx(prev.transactions, monthKey, studentId);
            const newEventMonthlyStats = applyEventMonthlyStatsDelta(prev.eventMonthlyStats, monthKey, studentId, { missions: 1 }, baseFromTx);

            const isAchievement = (mission.missionType || 'continuous') === 'achievement';
            const updatedList = isAchievement
                ? list.map(m => m.id === missionId ? { ...m, completedAt: timestamp } : m)
                : list;
            const nextPersonalMissions = isAchievement
                ? { ...existing, [studentId]: updatedList }
                : existing;

            return {
                ...prev,
                students: updatedStudents,
                transactions: updatedTransactions,
                eventMonthlyStats: newEventMonthlyStats,
                personalMissions: nextPersonalMissions,
            };
        });
    }, [setAppState]);

    const handlePurchase = useCallback((studentId: string, description: string, totalCost: number, couponDeduction: number, finalStoneCost: number) => {
        setAppState(prev => {
            if (prev === 'error' || !prev) return prev;
            const studentIdx = prev.students.findIndex(s => s.id === studentId);
            if (studentIdx === -1) return prev;

            const student = prev.students[studentIdx];
            const newStones = Math.max(0, (student.stones || 0) - finalStoneCost);
            
            const finalDesc = couponDeduction > 0 
                ? `${description} (쿠폰 ${couponDeduction} 사용)` 
                : description;

            const transaction: Transaction = {
                id: generateId(),
                studentId: student.id,
                type: 'purchase',
                description: finalDesc,
                amount: -finalStoneCost,
                timestamp: new Date().toISOString(),
                status: 'active',
                stoneBalanceBefore: student.stones,
                stoneBalanceAfter: newStones
            };

            const updatedStudents = [...prev.students];
            updatedStudents[studentIdx] = { ...student, stones: newStones };
            
            let updatedCoupons = [...prev.coupons];
            if (couponDeduction > 0) {
                const studentCoupons = updatedCoupons
                    .filter(c => c.studentId === studentId)
                    .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime());

                let remainingToDeduct = couponDeduction;
                const couponIdsToRemove = new Set<string>();
                const couponValuesToUpdate = new Map<string, number>();

                for (const coupon of studentCoupons) {
                    if (remainingToDeduct <= 0) break;
                    
                    if (coupon.value <= remainingToDeduct) {
                        remainingToDeduct -= coupon.value;
                        couponIdsToRemove.add(coupon.id);
                    } else {
                        couponValuesToUpdate.set(coupon.id, coupon.value - remainingToDeduct);
                        remainingToDeduct = 0;
                    }
                }

                updatedCoupons = updatedCoupons
                    .filter(c => !couponIdsToRemove.has(c.id)) 
                    .map(c => couponValuesToUpdate.has(c.id) 
                        ? { ...c, value: couponValuesToUpdate.get(c.id)! } 
                        : c
                    );
            }

            const updatedTransactions = [transaction, ...prev.transactions].slice(0, MAX_TRANSACTIONS);

            return { 
                ...prev, 
                students: updatedStudents, 
                transactions: updatedTransactions,
                coupons: updatedCoupons
            };
        });
    }, [setAppState]);

    const handleGachaPick = useCallback((studentId: string, pickedNumber: number, monthIdentifier: string) => {
        if (!appState || appState === 'error') return undefined;

        let gachaResult: { pickedNumber: number, prizeTier: number, prizeAmount: number } | undefined = undefined;

        setAppState(prev => {
            if (!prev || prev === 'error') return prev;
            
            let currentGacha = prev.gachaState[monthIdentifier] || { prizeMap: [], pickedNumbers: {} };
            
            if (currentGacha.prizeMap.length === 0) {
                const arr: number[] = [];
                const counts = prev.eventSettings.gachaPrizeCounts;
                for (let i = 0; i < (counts.first || 0); i++) arr.push(1);
                for (let i = 0; i < (counts.second || 0); i++) arr.push(2);
                for (let i = 0; i < (counts.third || 0); i++) arr.push(3);
                for (let i = 0; i < (counts.fourth || 0); i++) arr.push(4);
                while (arr.length < 100) arr.push(5);
                
                for (let i = arr.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [arr[i], arr[j]] = [arr[j], arr[i]];
                }
                currentGacha.prizeMap = arr;
            }

            if (currentGacha.pickedNumbers[studentId] !== undefined) return prev;

            const prizeTier = currentGacha.prizeMap[pickedNumber - 1];
            const tierMap: (keyof EventSettings['gachaPrizes'])[] = ['first', 'second', 'third', 'fourth', 'fifth'];
            const prizeAmount = prev.eventSettings.gachaPrizes[tierMap[prizeTier - 1]];

            gachaResult = { pickedNumber, prizeTier, prizeAmount };

            const studentIdx = prev.students.findIndex(s => s.id === studentId);
            if (studentIdx === -1) return prev;
            const student = prev.students[studentIdx];
            const newStones = Math.min(student.maxStones, (student.stones || 0) + prizeAmount);

            const tx: Transaction = {
                id: generateId(),
                studentId,
                type: 'gacha',
                description: `스톤 뽑기 (${prizeTier}등)`,
                amount: prizeAmount,
                timestamp: new Date().toISOString(),
                status: 'active',
                stoneBalanceBefore: student.stones,
                stoneBalanceAfter: newStones,
                eventMonth: monthIdentifier
            };

            const updatedStudents = [...prev.students];
            updatedStudents[studentIdx] = { ...student, stones: newStones };

            const newEventMonthlyStats = setEventParticipated(prev.eventMonthlyStats, monthIdentifier, studentId, true);

            return {
                ...prev,
                students: updatedStudents,
                transactions: [tx, ...prev.transactions].slice(0, MAX_TRANSACTIONS),
                gachaState: {
                    ...prev.gachaState,
                    [monthIdentifier]: {
                        ...currentGacha,
                        pickedNumbers: {
                            ...currentGacha.pickedNumbers,
                            [studentId]: pickedNumber
                        }
                    }
                },
                eventMonthlyStats: newEventMonthlyStats,
            };
        });

        return gachaResult;
    }, [appState, setAppState]);

    const handleCancelEventEntry = useCallback((studentId: string, monthIdentifier: string) => {
        setAppState(prev => {
            if (!prev || prev === 'error') return prev;
            
            const gachaData = prev.gachaState[monthIdentifier];
            if (!gachaData || gachaData.pickedNumbers[studentId] === undefined) return prev;

            const studentIdx = prev.students.findIndex(s => s.id === studentId);
            if (studentIdx === -1) return prev;

            const txIdx = prev.transactions.findIndex(t => 
                t.studentId === studentId && 
                t.type === 'gacha' && 
                t.eventMonth === monthIdentifier && 
                t.status === 'active'
            );
            
            if (txIdx === -1) return prev;
            const tx = prev.transactions[txIdx];

            const updatedStudents = [...prev.students];
            const student = updatedStudents[studentIdx];
            
            // 스마트 취소 로직 적용
            const actualImpact = tx.stoneBalanceAfter - tx.stoneBalanceBefore;
            let newStones;
            if (student.stones === tx.stoneBalanceAfter) {
                newStones = tx.stoneBalanceBefore;
            } else {
                newStones = Math.max(0, student.stones - actualImpact);
            }
            updatedStudents[studentIdx] = { ...student, stones: newStones };

            const updatedTransactions = [...prev.transactions];
            updatedTransactions[txIdx] = { ...tx, status: 'cancelled' };

            const newPickedNumbers = { ...gachaData.pickedNumbers };
            delete newPickedNumbers[studentId];

            const newEventMonthlyStats = setEventParticipated(prev.eventMonthlyStats, monthIdentifier, studentId, false);

            return {
                ...prev,
                students: updatedStudents,
                transactions: updatedTransactions,
                gachaState: {
                    ...prev.gachaState,
                    [monthIdentifier]: {
                        ...gachaData,
                        pickedNumbers: newPickedNumbers
                    }
                },
                eventMonthlyStats: newEventMonthlyStats,
            };
        });
    }, [setAppState]);

    const handleCancelTransaction = useCallback((transactionId: string) => {
        setAppState(prev => {
            if (prev === 'error' || !prev) return prev;
            const txIdx = prev.transactions.findIndex(t => t.id === transactionId);
            if (txIdx === -1 || prev.transactions[txIdx].status === 'cancelled') return prev;

            const transaction = prev.transactions[txIdx];
            const studentIdx = prev.students.findIndex(s => s.id === transaction.studentId);
            if (studentIdx === -1) return prev;

            const updatedStudents = [...prev.students];
            const student = updatedStudents[studentIdx];
            
            // 스마트 복구 로직: 최대치 도달 시의 영향을 정확히 되돌림
            const actualImpact = transaction.stoneBalanceAfter - transaction.stoneBalanceBefore;
            
            let newStones;
            // 만약 현재 학생의 스톤이 이 내역 직후의 상태와 같다면, 단순히 '변경 전'으로 점프
            if (student.stones === transaction.stoneBalanceAfter) {
                newStones = transaction.stoneBalanceBefore;
            } else {
                // 그 사이 다른 변동이 있었다면, 이 내역이 줬던 실제 수치만큼만 차감/가산
                newStones = Math.max(0, Math.min(student.maxStones, student.stones - actualImpact));
            }

            const updatedTransactions = [...prev.transactions];
            updatedTransactions[txIdx] = { ...transaction, status: 'cancelled' };
            updatedStudents[studentIdx] = { ...student, stones: newStones };

            let newEventMonthlyStats = prev.eventMonthlyStats;
            const monthKey = getMonthKey(transaction.timestamp);
            if (transaction.status === 'active') {
                if (transaction.type === 'mission' || transaction.type === 'attendance' || transaction.type === 'special_mission') {
                    newEventMonthlyStats = applyEventMonthlyStatsDelta(prev.eventMonthlyStats, monthKey, transaction.studentId, { missions: -1 });
                } else if (transaction.type === 'mission_adjustment') {
                    newEventMonthlyStats = applyEventMonthlyStatsDelta(prev.eventMonthlyStats, monthKey, transaction.studentId, { missions: -(transaction.missionCountDelta || 0) });
                } else if (transaction.type === 'penalty') {
                    newEventMonthlyStats = applyEventMonthlyStatsDelta(prev.eventMonthlyStats, monthKey, transaction.studentId, { penalties: -1 });
                }
            }

            // [추가] 이벤트(뽑기) 내역인 경우 뽑기판 데이터도 동기화하여 취소
            let newGachaState = prev.gachaState;
            if (transaction.type === 'gacha' && transaction.eventMonth) {
                const month = transaction.eventMonth;
                if (prev.gachaState[month]) {
                    const newPickedNumbers = { ...prev.gachaState[month].pickedNumbers };
                    delete newPickedNumbers[transaction.studentId];
                    newGachaState = {
                        ...prev.gachaState,
                        [month]: {
                            ...prev.gachaState[month],
                            pickedNumbers: newPickedNumbers
                        }
                    };
                }
            }

            return { 
                ...prev, 
                students: updatedStudents, 
                transactions: updatedTransactions,
                gachaState: newGachaState,
                ...(newEventMonthlyStats !== prev.eventMonthlyStats && { eventMonthlyStats: newEventMonthlyStats }),
            };
        });
    }, [setAppState]);

    const handleDeleteTransaction = useCallback((transactionId: string) => {
        setAppState(prev => {
            if (prev === 'error' || !prev) return prev;
            
            const transaction = prev.transactions.find(t => t.id === transactionId);
            if (!transaction) return prev;

            let updatedStudents = [...prev.students];
            let newGachaState = prev.gachaState;
            let newEventMonthlyStats = prev.eventMonthlyStats;

            if (transaction.status === 'active') {
                const studentIdx = updatedStudents.findIndex(s => s.id === transaction.studentId);
                if (studentIdx !== -1) {
                    const student = updatedStudents[studentIdx];
                    
                    // 스마트 복구 로직 동일 적용
                    const actualImpact = transaction.stoneBalanceAfter - transaction.stoneBalanceBefore;
                    let newStones;
                    if (student.stones === transaction.stoneBalanceAfter) {
                        newStones = transaction.stoneBalanceBefore;
                    } else {
                        newStones = Math.max(0, Math.min(student.maxStones, student.stones - actualImpact));
                    }
                    
                    updatedStudents[studentIdx] = { ...student, stones: newStones };
                }

                // [추가] 이벤트 내역 삭제 시 뽑기판 점유 해제 + 참여 여부 해제
                if (transaction.type === 'gacha' && transaction.eventMonth) {
                    const month = transaction.eventMonth;
                    if (prev.gachaState[month]) {
                        const newPickedNumbers = { ...prev.gachaState[month].pickedNumbers };
                        delete newPickedNumbers[transaction.studentId];
                        newGachaState = {
                            ...prev.gachaState,
                            [month]: {
                                ...prev.gachaState[month],
                                pickedNumbers: newPickedNumbers
                            }
                        };
                    }
                }

                if (transaction.type === 'gacha' && transaction.eventMonth) {
                    newEventMonthlyStats = setEventParticipated(prev.eventMonthlyStats, transaction.eventMonth, transaction.studentId, false);
                }
                const monthKey = getMonthKey(transaction.timestamp);
                if (transaction.type === 'mission' || transaction.type === 'attendance' || transaction.type === 'special_mission') {
                    newEventMonthlyStats = applyEventMonthlyStatsDelta(prev.eventMonthlyStats, monthKey, transaction.studentId, { missions: -1 });
                } else if (transaction.type === 'mission_adjustment') {
                    newEventMonthlyStats = applyEventMonthlyStatsDelta(prev.eventMonthlyStats, monthKey, transaction.studentId, { missions: -(transaction.missionCountDelta || 0) });
                } else if (transaction.type === 'penalty') {
                    newEventMonthlyStats = applyEventMonthlyStatsDelta(prev.eventMonthlyStats, monthKey, transaction.studentId, { penalties: -1 });
                }
                if (newEventMonthlyStats !== prev.eventMonthlyStats) {
                    return { 
                        ...prev, 
                        students: updatedStudents, 
                        transactions: prev.transactions.filter(t => t.id !== transactionId),
                        gachaState: newGachaState,
                        eventMonthlyStats: newEventMonthlyStats,
                    };
                }
            }

            return { 
                ...prev, 
                students: updatedStudents, 
                transactions: prev.transactions.filter(t => t.id !== transactionId),
                gachaState: newGachaState,
                ...(newEventMonthlyStats !== prev.eventMonthlyStats && { eventMonthlyStats: newEventMonthlyStats }),
            };
        });
    }, [setAppState]);

    const handleTransferStones = useCallback((fromId: string, toId: string, amount: number) => {
        setAppState(prev => {
            if (prev === 'error' || !prev) return prev;
            const fromIdx = prev.students.findIndex(s => s.id === fromId);
            const toIdx = prev.students.findIndex(s => s.id === toId);
            
            if (fromIdx === -1 || toIdx === -1) return prev;
            
            const from = prev.students[fromIdx];
            const to = prev.students[toIdx];
            
            if ((from.stones || 0) < amount) return prev;

            const newFromStones = (from.stones || 0) - amount;
            const newToStones = Math.min(to.maxStones, (to.stones || 0) + amount);

            const timestamp = new Date().toISOString();
            const t1: Transaction = {
                id: generateId(), studentId: fromId, type: 'transfer', description: `${to.name}에게 스톤 보냄`,
                amount: -amount, timestamp, status: 'active',
                stoneBalanceBefore: from.stones, stoneBalanceAfter: newFromStones
            };
            const t2: Transaction = {
                id: generateId(), studentId: toId, type: 'transfer', description: `${from.name}에게서 스톤 받음`,
                amount: amount, timestamp, status: 'active',
                stoneBalanceBefore: to.stones, stoneBalanceAfter: newToStones
            };

            const updatedStudents = [...prev.students];
            updatedStudents[fromIdx] = { ...from, stones: newFromStones };
            updatedStudents[toIdx] = { ...to, stones: newToStones };
            
            const updatedTransactions = [t1, t2, ...prev.transactions].slice(0, MAX_TRANSACTIONS);

            return { ...prev, students: updatedStudents, transactions: updatedTransactions };
        });
    }, [setAppState]);

    const handleRecordChessMatch = useCallback((whitePlayerId: string, blackPlayerId: string, result: 'white' | 'black' | 'draw') => {
        setAppState(prev => {
            if (prev === 'error' || !prev) return prev;

            const getRating = (id: string) => {
                if (id === 'non-chess-player') return prev.generalSettings.nonChessPlayerRating;
                const s = prev.students.find(s => s.id === id);
                return s?.chessRating || 1000;
            };

            const whiteRating = getRating(whitePlayerId);
            const blackRating = getRating(blackPlayerId);
            
            const { newWhiteRating, newBlackRating, ratingDeltaForWhite } = calculateNewElo(
                whiteRating, 
                blackRating, 
                result, 
                prev.generalSettings.eloKFactor
            );

            const newMatch: ChessMatch = {
                id: generateId(),
                timestamp: new Date().toISOString(),
                whitePlayerId,
                blackPlayerId,
                result,
                whitePlayerNewRating: newWhiteRating,
                blackPlayerNewRating: newBlackRating,
                ratingDeltaForWhite,
                status: 'active'
            };

            const updatedStudents = prev.students.map(s => {
                if (s.id === whitePlayerId && whitePlayerId !== 'non-chess-player') {
                    return { ...s, chessRating: newWhiteRating, chessGamesPlayed: (s.chessGamesPlayed || 0) + 1 };
                }
                if (s.id === blackPlayerId && blackPlayerId !== 'non-chess-player') {
                    return { ...s, chessRating: newBlackRating, chessGamesPlayed: (s.chessGamesPlayed || 0) + 1 };
                }
                return s;
            });

            const updatedMatches = [newMatch, ...prev.chessMatches].slice(0, MAX_CHESS_MATCHES);

            return {
                ...prev,
                students: updatedStudents,
                chessMatches: updatedMatches
            };
        });
    }, [setAppState]);

    if ((appState as unknown) === 'error') {
        return <AppLoader 
            message="데이터를 불러오는 중 오류가 발생했습니다. 네트워크 연결을 확인해주세요." 
            showLogout 
            onLogout={onLogout} 
        />;
    }

    if (appState === null) {
        return <AppLoader message="데이터를 안전하게 불러오는 중..." />;
    }

    return (
        <div className="app-container">
            {/* 저장 실패 시 경고 배너 */}
            {saveError && (
                <div className="save-error-banner" style={{ background: '#d32f2f', color: 'white', textAlign: 'center', padding: '0.8rem', fontWeight: 'bold', zIndex: 10000, position: 'fixed', top: 0, left: 0, right: 0 }}>
                    ⚠️ 데이터 저장에 실패했습니다! 네트워크 연결을 확인하세요. 이 상태에서 새로고침하면 작업 내용이 유실될 수 있습니다.
                </div>
            )}
            
            <header className="header" style={saveError ? { marginTop: '40px' } : {}}>
                <div className="header-title-group">
                    <h1 onClick={() => setView('student')} style={{cursor: 'pointer'}}>
                        {generalSettings.academyName}
                        {isDemo && <span className="demo-badge">DEMO</span>}
                    </h1>
                    {isSaving && <div className="saving-indicator">💾 저장 중...</div>}
                </div>
                
                <nav className="view-toggle">
                    <button className={`toggle-btn ${view === 'student' ? 'active' : ''}`} onClick={() => setView('student')}>👨‍🎓 바둑반</button>
                    <button className={`toggle-btn ${view === 'chess' ? 'active' : ''}`} onClick={() => view !== 'chess' && setView('chess')}>♟️ 체스반</button>
                    <button className={`toggle-btn ${view === 'tournament' ? 'active' : ''}`} onClick={() => setView('tournament')}>🏆 대회</button>
                    <button className={`toggle-btn ${view === 'event' ? 'active' : ''}`} onClick={() => setView('event')}>🎁 이벤트</button>
                    <button className={`toggle-btn ${view === 'admin' ? 'active' : ''}`} onClick={() => setView('admin')}>⚙️ 관리자</button>
                </nav>

                <div className="header-controls">
                    {user.uid === 'master' && <button className="btn-sm" onClick={() => setView('master')} style={{marginRight: '10px'}}>MASTER</button>}
                    <button className="btn-icon" onClick={() => setIsAccountModalOpen(true)} title="계정 설정">👤</button>
                </div>
            </header>

            <main className="main-content">
                <div className="scroll-content-inner">
                    {view === 'student' && (
                        <StudentView 
                            students={students} coupons={coupons} transactions={transactions}
                            groupSettings={groupSettings} generalSettings={generalSettings} eventSettings={eventSettings} eventMonthlyStats={eventMonthlyStats}
                            setView={setView}
                            onStudentClick={(s) => { setSelectedStudent(s); setIsSidebarOpen(true); }}
                            onNavigateToEvent={(s) => { setEventOpenForMonth(null); setSelectedStudent(s); setView('event'); }}
                        />
                    )}
                    {view === 'chess' && (
                        <ChessPanel 
                            students={students} matches={chessMatches} transactions={transactions} 
                            generalSettings={generalSettings} missions={missions} chessMissions={chessMissions}
                            onRecordMatch={handleRecordChessMatch} onCancelMatch={() => {}}
                            onChessAttendance={(id) => handleAddTransaction(id, 'chess_attendance', '체스반 출석', generalSettings.chessAttendanceValue)}
                            onAddTransaction={handleAddTransaction}
                            onUpdateGeneralSettings={(s) => setAppState(prev => prev === 'error' ? prev : ({ ...prev!, generalSettings: s }))}
                            onUpdateChessRating={(id, r) => setAppState(prev => prev === 'error' ? prev : ({ ...prev!, students: prev!.students.map(s => s.id === id ? {...s, chessRating: r} : s) }))}
                            onChessAbsencePenalty={(id) => handleAddTransaction(id, 'adjustment', '체스반 결석', -10)}
                        />
                    )}
                    {view === 'tournament' && (
                        <TournamentView 
                            students={students} data={tournamentData} settings={tournamentSettings} 
                            setData={(d) => setAppState(prev => prev === 'error' ? prev : ({ ...prev!, tournamentData: typeof d === 'function' ? d(prev!.tournamentData) : d }))}
                            setSettings={(s) => setAppState(prev => prev === 'error' ? prev : ({ ...prev!, tournamentSettings: typeof s === 'function' ? s(prev!.tournamentSettings) : s }))}
                            onBulkAddTransaction={(ids, desc, amt) => ids.forEach(id => handleAddTransaction(id, 'adjustment', desc, amt))}
                        />
                    )}
                    {view === 'event' && (
                        <EventView 
                            students={students} transactions={transactions} eventMonthlyStats={eventMonthlyStats} eventSettings={eventSettings} 
                            gachaStates={gachaState} targetStudent={freshSelectedStudent}
                            initialMonth={eventOpenForMonth}
                            onClearTargetStudent={() => setSelectedStudent(null)}
                            onInitialMonthApplied={() => setEventOpenForMonth(null)}
                            setEventSettings={(s) => setAppState(prev => prev === 'error' ? prev : ({ ...prev!, eventSettings: typeof s === 'function' ? s(prev!.eventSettings) : s }))}
                            onAddTransaction={handleAddTransaction}
                            onGachaPick={handleGachaPick} 
                            onCancelEventEntry={handleCancelEventEntry}
                        />
                    )}
                    {view === 'admin' && (
                        <AdminPanel 
                            students={students} missions={missions} chessMissions={chessMissions} specialMissions={specialMissions}
                            shopItems={shopItems} shopSettings={shopSettings} shopCategories={shopCategories} groupSettings={groupSettings} generalSettings={generalSettings}
                            setMissions={(m) => setAppState(prev => prev === 'error' ? prev : ({ ...prev!, missions: typeof m === 'function' ? m(prev!.missions) : m }))}
                            setChessMissions={(m) => setAppState(prev => prev === 'error' ? prev : ({ ...prev!, chessMissions: typeof m === 'function' ? m(prev!.chessMissions) : m }))}
                            setSpecialMissions={(m) => setAppState(prev => prev === 'error' ? prev : ({ ...prev!, specialMissions: typeof m === 'function' ? m(prev!.specialMissions) : m }))}
                            setShopItems={(i) => setAppState(prev => prev === 'error' ? prev : ({ ...prev!, shopItems: typeof i === 'function' ? i(prev!.shopItems) : i }))}
                            setShopSettings={(s) => setAppState(prev => prev === 'error' ? prev : ({ ...prev!, shopSettings: typeof s === 'function' ? s(prev!.shopSettings) : s }))}
                            setShopCategories={(c) => setAppState(prev => prev === 'error' ? prev : ({ ...prev!, shopCategories: typeof c === 'function' ? c(prev!.shopCategories) : c }))}
                            onSaveStudent={(data, id) => {
                                setAppState(prev => {
                                    if (prev === 'error' || !prev) return prev;
                                    
                                    const { group } = getGroupForRank(data.rank);
                                    const maxStones = prev.groupSettings[group]?.maxStones || 50;
                                    const studentUpdates = { ...data, group, maxStones };

                                    if (id) {
                                        return { 
                                            ...prev, 
                                            students: prev.students.map(s => s.id === id ? { ...s, ...studentUpdates } : s) 
                                        };
                                    }
                                    
                                    const newStudent: Student = { 
                                        ...studentUpdates, 
                                        id: generateId(), 
                                        stones: 0,
                                        chessRating: prev.generalSettings.nonChessPlayerRating || 1000 
                                    };
                                    return { ...prev, students: [...prev.students, newStudent] };
                                });
                            }}
                            onDeleteStudent={(id) => setAppState(prev => prev === 'error' ? prev : ({ ...prev!, students: prev!.students.filter(s => s.id !== id) }))}
                            onUpdateGroupSettings={(s) => setAppState(prev => prev === 'error' ? prev : ({ ...prev!, groupSettings: s }))}
                            onUpdateGeneralSettings={(s) => setAppState(prev => prev === 'error' ? prev : ({ ...prev!, generalSettings: s }))}
                            onBulkAddTransaction={(ids, desc, amt) => ids.forEach(id => handleAddTransaction(id, 'adjustment', desc, amt))}
                            onBulkUpdateStudents={(ids, updates) => setAppState(prev => {
                                if (prev === 'error' || !prev) return prev;
                                return {
                                    ...prev,
                                    students: prev.students.map(s => {
                                        if (!ids.includes(s.id)) return s;
                                        
                                        const finalRank = updates.rank || s.rank;
                                        const { group } = getGroupForRank(finalRank);
                                        const maxStones = prev.groupSettings[group]?.maxStones || 50;
                                        
                                        return { 
                                            ...s, 
                                            ...updates, 
                                            group, 
                                            maxStones 
                                        };
                                    })
                                };
                            })}
                            onAddCoupon={(c) => setAppState(prev => prev === 'error' ? prev : ({ ...prev!, coupons: [...prev!.coupons, { ...c, id: generateId() }] }))}
                            onImportStudents={(data, mode) => {
                                setAppState(prev => {
                                    if (prev === 'error' || !prev) return prev;
                                    const studentsWithIds = data.map(s => ({ ...s, id: generateId(), group: getGroupForRank(s.rank).group, maxStones: prev.groupSettings[getGroupForRank(s.rank).group]?.maxStones || 50, stones: s.stones || 0 }));
                                    return { ...prev, students: mode === 'replace' ? studentsWithIds : [...prev.students, ...studentsWithIds] };
                                });
                            }}
                            onImportMissions={() => {}} onImportShopItems={() => {}}
                        />
                    )}
                    {view === 'master' && user.uid === 'master' && <MasterPanel user={user} />}
                </div>
            </main>

            <QuickMenuSidebar 
                isOpen={isSidebarOpen} student={freshSelectedStudent} students={students} missions={missions} specialMissions={specialMissions}
                shopItems={appState && appState !== 'error' ? appState.shopItems : []} shopSettings={shopSettings} shopCategories={shopCategories} coupons={coupons} transactions={transactions}
                groupSettings={groupSettings} generalSettings={generalSettings} eventSettings={eventSettings} eventMonthlyStats={eventMonthlyStats}
                onClose={() => setIsSidebarOpen(false)}
                onAddTransaction={handleAddTransaction} onUpdateTransaction={(tx) => setAppState(prev => prev === 'error' ? prev : ({ ...prev!, transactions: prev!.transactions.map(t => t.id === tx.id ? tx : t) }))} onDeleteCoupon={(id) => setAppState(prev => prev === 'error' ? prev : ({ ...prev!, coupons: prev!.coupons.filter(c => c.id !== id) }))}
                onPurchase={handlePurchase} onCancelTransaction={handleCancelTransaction} onDeleteTransaction={handleDeleteTransaction}
                onTransferStones={handleTransferStones} 
                onUpdateJosekiProgress={(id, p) => setAppState(prev => prev === 'error' ? prev : ({ ...prev!, students: prev!.students.map(s => s.id === id ? {...s, josekiProgress: p} : s) }))} 
                onUpdateContinuousMissionName={(id, name) => setAppState(prev => prev === 'error' ? prev : ({ ...prev!, students: prev!.students.map(s => s.id === id ? {...s, continuousMissionName: name} : s) }))}
                onCompleteJosekiMission={(id) => handleAddTransaction(id, 'joseki_mission', '정석 미션 완료', generalSettings.josekiMissionValue)} onAssignSpecialMission={(id) => setAppState(prev => {
                    if (!prev || prev === 'error') return prev;
                    const student = prev.students.find(s => s.id === id);
                    if (!student) return prev;
                    
                    const groupOrder = prev.generalSettings.groupOrder;
                    const studentGroupIdx = groupOrder.indexOf(student.group);
                    
                    // 1. 가용 미션 필터링
                    const available = prev.specialMissions.filter(m => {
                        const missionGroupIdx = groupOrder.indexOf(m.group);
                        if (missionGroupIdx === -1 || studentGroupIdx === -1) return true;

                        // 상위 그룹 제한 (Exclusive): 학생이 미션 그룹보다 상급자(index가 작음)이면 필터링
                        if (m.isExclusive && studentGroupIdx < missionGroupIdx) return false;

                        // 하위 그룹 제한 (AtLeast): 학생이 미션 그룹보다 하급자(index가 큼)이면 필터링
                        if (m.isAtLeast && studentGroupIdx > missionGroupIdx) return false;

                        return true;
                    });
                    
                    if (available.length === 0) return prev;

                    // 2. 가중치(확률) 기반 추출 로직
                    const weights = (prev.generalSettings.specialMissionWeights && prev.generalSettings.specialMissionWeights[student.group]) 
                        ? prev.generalSettings.specialMissionWeights[student.group] 
                        : { 1: 20, 2: 20, 3: 20, 4: 20, 5: 20 };

                    // 먼저 출현할 '별 개수'를 가중치에 따라 결정
                    const starPool: number[] = [];
                    Object.entries(weights).forEach(([stars, weight]) => {
                        // 해당 별 개수의 미션이 하나라도 있는 경우에만 풀에 추가
                        if (available.some(m => m.stars === parseInt(stars))) {
                            // FIX: Cast weight to number to avoid comparison with unknown errors.
                            for (let i = 0; i < (weight as number); i++) starPool.push(parseInt(stars));
                        }
                    });

                    // 만약 가중치 설정된 별 개수의 미션이 하나도 없다면 전체에서 완전 무작위 추출
                    if (starPool.length === 0) {
                        const randomMission = available[Math.floor(Math.random() * available.length)];
                        const today = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).split(' ')[0];
                        return { ...prev, students: prev.students.map(s => s.id === id ? { ...s, dailySpecialMissionId: randomMission.id, specialMissionDate: today } : s) };
                    }

                    const selectedStars = starPool[Math.floor(Math.random() * starPool.length)];
                    const starMissions = available.filter(m => m.stars === selectedStars);
                    const randomMission = starMissions[Math.floor(Math.random() * starMissions.length)];
                    
                    const today = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).split(' ')[0];
                    return { ...prev, students: prev.students.map(s => s.id === id ? { ...s, dailySpecialMissionId: randomMission.id, specialMissionDate: today } : s) };
                })} onClearSpecialMission={(id) => setAppState(prev => prev === 'error' ? prev : ({ ...prev!, students: prev!.students.map(s => s.id === id ? { ...s, dailySpecialMissionId: undefined, specialMissionDate: undefined } : s) }))}
                onAdjustMissionCount={handleAdjustMissionCount}
                personalMissions={personalMissions}
                onAddPersonalMission={handleAddPersonalMission}
                onUpdatePersonalMissionScore={handleUpdatePersonalMissionScore}
                onUpdatePersonalMission={handleUpdatePersonalMission}
                onDeletePersonalMission={handleDeletePersonalMission}
                onReorderPersonalMissions={handleReorderPersonalMissions}
                onCompletePersonalMission={handleCompletePersonalMission}
                individualMissionSeries={individualMissionSeries}
                studentMissionProgress={studentMissionProgress}
                onAssignIndividualMission={handleAssignIndividualMission}
                onUnassignIndividualMission={handleUnassignIndividualMission}
                onCompleteIndividualStep={handleCompleteIndividualStep}
            />

            {isAccountModalOpen && (
                <AccountSettingsModal isOpen={isAccountModalOpen} onClose={() => setIsAccountModalOpen(false)} onLogout={onLogout} user={user} />
            )}
        </div>
    );
};
