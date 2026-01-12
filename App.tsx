
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, firebaseError, isDemoMode } from './firebase';
import { useFirestoreState } from './hooks/useFirestoreState';
import { INITIAL_STUDENTS, INITIAL_MISSIONS, INITIAL_SHOP_ITEMS, INITIAL_GROUP_SETTINGS, INITIAL_GENERAL_SETTINGS, INITIAL_EVENT_SETTINGS, INITIAL_TOURNAMENT_DATA, INITIAL_TOURNAMENT_SETTINGS, INITIAL_SHOP_CATEGORIES, INITIAL_GACHA_STATES, INITIAL_CHESS_MISSIONS, INITIAL_SPECIAL_MISSIONS } from './data/initialData';
import type { Student, Mission, ShopItem, View, Transaction, Coupon, GroupSettings, AppData, UsedCouponInfo, ChessMatch, User, MasterData, GachaData, SpecialMission } from './types';
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
});

const AppLoader = ({ message }: { message: string }) => (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '1.2rem', background: 'var(--bg-color)' }}>
        {message}
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
            setCurrentUser(user);
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
                if (role === 'master') setCurrentUser({ uid: 'master', email: 'Master Admin' });
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
    const [appState, setAppState] = useFirestoreState<AppData>(user.uid, getInitialData);
    const validAppState = appState === 'error' ? null : appState;

    const [view, setView] = useState<View>('student');
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const students = validAppState?.students || [];
    const transactions = validAppState?.transactions || [];
    const coupons = validAppState?.coupons || [];
    const groupSettings = validAppState?.groupSettings || INITIAL_GROUP_SETTINGS;
    const generalSettings = validAppState?.generalSettings || INITIAL_GENERAL_SETTINGS;
    const eventSettings = validAppState?.eventSettings || INITIAL_EVENT_SETTINGS;
    const shopItems = validAppState?.shopItems || [];
    const shopSettings = validAppState?.shopSettings || { bulkPurchaseDiscountRate: 0 };
    const shopCategories = validAppState?.shopCategories || INITIAL_SHOP_CATEGORIES;
    const specialMissions = validAppState?.specialMissions || [];
    const chessMissions = validAppState?.chessMissions || [];
    const tournamentData = validAppState?.tournamentData || { ...INITIAL_TOURNAMENT_DATA, teams: [{ name: 'A', players: [] }, { name: 'B', players: [] }] };
    const tournamentSettings = validAppState?.tournamentSettings || INITIAL_TOURNAMENT_SETTINGS;
    const chessMatches = validAppState?.chessMatches || [];
    const gachaState = validAppState?.gachaState || INITIAL_GACHA_STATES;

    // 미션 완료 및 점수 합산 핵심 로직
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

            return { 
                ...prev, 
                students: updatedStudents, 
                transactions: [transaction, ...prev.transactions] 
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
            
            const transaction: Transaction = {
                id: generateId(),
                studentId,
                type: 'purchase',
                description,
                amount: -finalStoneCost,
                timestamp: new Date().toISOString(),
                status: 'active',
                stoneBalanceBefore: student.stones,
                stoneBalanceAfter: newStones
            };

            const updatedStudents = [...prev.students];
            updatedStudents[studentIdx] = { ...student, stones: newStones };

            return { ...prev, students: updatedStudents, transactions: [transaction, ...prev.transactions] };
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

            const student = prev.students[studentIdx];
            const reversalAmount = -transaction.amount;
            const newStones = Math.max(0, Math.min(student.maxStones, (student.stones || 0) + reversalAmount));

            const updatedTransactions = [...prev.transactions];
            updatedTransactions[txIdx] = { ...transaction, status: 'cancelled' };

            const updatedStudents = [...prev.students];
            updatedStudents[studentIdx] = { ...student, stones: newStones };

            return { ...prev, students: updatedStudents, transactions: updatedTransactions };
        });
    }, [setAppState]);

    const handleDeleteTransaction = useCallback((transactionId: string) => {
        setAppState(prev => {
            if (prev === 'error' || !prev) return prev;
            return { ...prev, transactions: prev.transactions.filter(t => t.id !== transactionId) };
        });
    }, [setAppState]);

    const handleTransferStones = useCallback((fromId: string, toId: string, amount: number) => {
        setAppState(prev => {
            if (prev === 'error' || !prev) return prev;
            const from = prev.students.find(s => s.id === fromId);
            const to = prev.students.find(s => s.id === toId);
            if (!from || !to || (from.stones || 0) < amount) return prev;

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

            const updatedStudents = prev.students.map(s => {
                if (s.id === fromId) return { ...s, stones: newFromStones };
                if (s.id === toId) return { ...s, stones: newToStones };
                return s;
            });

            return { ...prev, students: updatedStudents, transactions: [t1, t2, ...prev.transactions] };
        });
    }, [setAppState]);

    // FIX: Implemented handleRecordChessMatch to calculate Elo ratings and update chess match history.
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
                    return { 
                        ...s, 
                        chessRating: newWhiteRating, 
                        chessGamesPlayed: (s.chessGamesPlayed || 0) + 1 
                    };
                }
                if (s.id === blackPlayerId && blackPlayerId !== 'non-chess-player') {
                    return { 
                        ...s, 
                        chessRating: newBlackRating, 
                        chessGamesPlayed: (s.chessGamesPlayed || 0) + 1 
                    };
                }
                return s;
            });

            return {
                ...prev,
                students: updatedStudents,
                chessMatches: [newMatch, ...prev.chessMatches]
            };
        });
    }, [setAppState]);

    if (!validAppState) return <AppLoader message="데이터를 안전하게 불러오는 중..." />;

    return (
        <div className="app-container">
            <header className="header">
                <div className="header-title-group">
                    <h1 onClick={() => setView('student')} style={{cursor: 'pointer'}}>
                        {generalSettings.academyName}
                        {isDemo && <span className="demo-badge" style={{fontSize: '0.7rem', padding: '2px 6px', marginLeft: '8px'}}>DEMO</span>}
                    </h1>
                </div>
                
                <div className="view-toggle">
                    <button className={`toggle-btn ${view === 'student' ? 'active' : ''}`} onClick={() => setView('student')}>👨‍🎓 바둑반</button>
                    <button className={`toggle-btn ${view === 'chess' ? 'active' : ''}`} onClick={() => setView('chess')}>♟️ 체스반</button>
                    <button className={`toggle-btn ${view === 'tournament' ? 'active' : ''}`} onClick={() => setView('tournament')}>🏆 대회</button>
                    <button className={`toggle-btn ${view === 'event' ? 'active' : ''}`} onClick={() => setView('event')}>🎁 이벤트</button>
                    <button className={`toggle-btn ${view === 'admin' ? 'active' : ''}`} onClick={() => setView('admin')}>⚙️ 설정</button>
                </div>

                <div className="header-controls">
                    {user.uid === 'master' && <button className="btn-sm" onClick={() => setView('master')} style={{marginRight: '10px'}}>MASTER</button>}
                    <button className="btn-icon" onClick={() => setIsAccountModalOpen(true)} title="계정 설정">👤</button>
                </div>
            </header>

            <main className="main-content">
                {view === 'student' && (
                    <StudentView 
                        students={students} coupons={coupons} transactions={transactions}
                        groupSettings={groupSettings} generalSettings={generalSettings} eventSettings={eventSettings}
                        setView={setView}
                        onStudentClick={(s) => { setSelectedStudent(s); setIsSidebarOpen(true); }}
                        onNavigateToEvent={(s) => { setSelectedStudent(s); setView('event'); }}
                    />
                )}
                {view === 'chess' && (
                    <ChessPanel 
                        students={students} matches={chessMatches} transactions={transactions} 
                        generalSettings={generalSettings} missions={[]} chessMissions={chessMissions}
                        onRecordMatch={handleRecordChessMatch} onCancelMatch={() => {}}
                        onChessAttendance={(id) => handleAddTransaction(id, 'chess_attendance', '체스반 출석', generalSettings.chessAttendanceValue)}
                        onAddTransaction={handleAddTransaction}
                        onUpdateGeneralSettings={(s) => setAppState(prev => prev === 'error' ? prev : ({ ...prev!, generalSettings: s }))}
                        onUpdateChessRating={() => {}} onChessAbsencePenalty={() => {}}
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
                        students={students} transactions={transactions} eventSettings={eventSettings} 
                        gachaStates={gachaState} targetStudent={selectedStudent}
                        onClearTargetStudent={() => setSelectedStudent(null)}
                        setEventSettings={(s) => setAppState(prev => prev === 'error' ? prev : ({ ...prev!, eventSettings: typeof s === 'function' ? s(prev!.eventSettings) : s }))}
                        onAddTransaction={handleAddTransaction}
                        onGachaPick={() => undefined} onCancelEventEntry={() => {}}
                    />
                )}
                {view === 'admin' && (
                    <AdminPanel 
                        students={students} missions={validAppState.missions} chessMissions={chessMissions} specialMissions={specialMissions}
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
                                if (id) return { ...prev, students: prev.students.map(s => s.id === id ? { ...s, ...data } : s) };
                                const newStudent: Student = { ...data, id: generateId(), stones: 0, maxStones: groupSettings[getGroupForRank(data.rank).group]?.maxStones || 50, group: getGroupForRank(data.rank).group };
                                return { ...prev, students: [...prev.students, newStudent] };
                            });
                        }}
                        onDeleteStudent={(id) => setAppState(prev => prev === 'error' ? prev : ({ ...prev!, students: prev!.students.filter(s => s.id !== id) }))}
                        onUpdateGroupSettings={(s) => setAppState(prev => prev === 'error' ? prev : ({ ...prev!, groupSettings: s }))}
                        onUpdateGeneralSettings={(s) => setAppState(prev => prev === 'error' ? prev : ({ ...prev!, generalSettings: s }))}
                        onBulkAddTransaction={(ids, desc, amt) => ids.forEach(id => handleAddTransaction(id, 'adjustment', desc, amt))}
                        onBulkUpdateStudents={(ids, updates) => setAppState(prev => prev === 'error' ? prev : ({ ...prev!, students: prev!.students.map(s => ids.includes(s.id) ? { ...s, ...updates } : s) }))}
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
            </main>

            <QuickMenuSidebar 
                isOpen={isSidebarOpen} student={selectedStudent} students={students} missions={validAppState.missions} specialMissions={specialMissions}
                shopItems={shopItems} shopSettings={shopSettings} shopCategories={shopCategories} coupons={coupons} transactions={transactions}
                groupSettings={groupSettings} generalSettings={generalSettings}
                onClose={() => setIsSidebarOpen(false)}
                onAddTransaction={handleAddTransaction} onUpdateTransaction={() => {}} onDeleteCoupon={() => {}}
                onPurchase={handlePurchase} onCancelTransaction={handleCancelTransaction} onDeleteTransaction={handleDeleteTransaction}
                onTransferStones={handleTransferStones} onUpdateJosekiProgress={() => {}} onCompleteJosekiMission={() => {}} onAssignSpecialMission={() => {}} onClearSpecialMission={() => {}}
            />

            {isAccountModalOpen && (
                <AccountSettingsModal isOpen={isAccountModalOpen} onClose={() => setIsAccountModalOpen(false)} onLogout={onLogout} user={user} />
            )}
        </div>
    );
};
