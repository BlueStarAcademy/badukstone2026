
import React, { useState, useEffect, useCallback, useRef } from 'react';
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

const DataLoadError = ({ onReset }: { onReset: () => void }) => (
    <div className="login-container">
        <div className="login-form">
            <h1>데이터 로딩 오류</h1>
            <p>데이터를 불러오는 데 실패했습니다.</p>
            <button onClick={onReset} className="btn danger">데이터 초기화 (데모 모드)</button>
        </div>
    </div>
);

const AppLoader = ({ message }: { message: string }) => (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '1.2rem' }}>
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
        if (auth && !isDemoMode) {
            auth.signOut().catch(error => console.error('Sign out error', error));
        }
        setCurrentUser(null);
        setUseDemo(false);
    };

    const handleDemoLogin = () => {
        setUseDemo(true);
        setCurrentUser({ uid: 'demo_user', email: 'demo@example.com' });
    };

    if (authLoading) {
        return <AppLoader message="로딩 중..." />;
    }

    if (!currentUser && !useDemo) {
        return <LoginPage 
            onLoginSuccess={(role) => {
                if (role === 'master') {
                    setCurrentUser({ uid: 'master', email: 'Master Admin' });
                } else if (isDemoMode) {
                    handleDemoLogin();
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

interface HistoryItem {
    state: AppData;
    description: string;
}

const MainApp = ({ user, onLogout, isDemo }: MainAppProps) => {
    const [appState, setAppState] = useFirestoreState<AppData>(user.uid, getInitialData);
    const validAppState = appState === 'error' ? null : appState;

    const [view, setView] = useState<View>('student');
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [eventTargetStudent, setEventTargetStudent] = useState<Student | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [titleInputValue, setTitleInputValue] = useState('바둑학원 스톤 관리');

    // Undo System
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const isUndoing = useRef(false);

    // Wrap setAppState to record history with description
    const updateAppState = useCallback((newStateOrFn: React.SetStateAction<AppData | 'error' | null>, description: string = "작업 수행") => {
        setAppState(prev => {
            if (prev && prev !== 'error' && !isUndoing.current) {
                // Store clone of current state before applying change
                setHistory(h => [{ state: JSON.parse(JSON.stringify(prev)), description }, ...h].slice(0, 20));
            }
            return typeof newStateOrFn === 'function' ? (newStateOrFn as any)(prev) : newStateOrFn;
        });
    }, [setAppState]);

    const handleUndo = () => {
        if (history.length === 0) return;
        const lastAction = history[0];
        isUndoing.current = true;
        setAppState(lastAction.state);
        setHistory(h => h.slice(1));
        setTimeout(() => { 
            isUndoing.current = false; 
            alert(`되돌리기 완료: ${lastAction.description}`);
        }, 100);
    };

    useEffect(() => {
        if (appState && appState !== 'error') {
            setTitleInputValue(appState.generalSettings.academyName);
        }
    }, [appState]);

    useEffect(() => {
        if (selectedStudent && appState && appState !== 'error') {
            const updatedSelectedStudent = appState.students.find(s => s.id === selectedStudent.id);
            setSelectedStudent(updatedSelectedStudent || null);
        }
    }, [appState, selectedStudent?.id]);

    useEffect(() => {
        if (!validAppState) return;
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        if (validAppState.lastBirthdayCouponMonth === currentMonth) return;

        const birthdayStudents = validAppState.students.filter(s => {
            if (!s.birthday || s.status !== '재원') return false;
            const [m] = s.birthday.split('-');
            return parseInt(m, 10) === currentMonth + 1;
        });

        if (birthdayStudents.length === 0) {
             updateAppState(prev => prev && prev !== 'error' ? { ...prev, lastBirthdayCouponMonth: currentMonth } : prev, "생일 체크");
             return;
        }

        const couponValue = validAppState.generalSettings.birthdayCouponValue || 300;
        const newCoupons: Coupon[] = [];
        const alreadyIssuedIds = new Set(
            validAppState.coupons
                .filter(c => c.description.includes(`생일 축하 쿠폰 ${currentYear}`))
                .map(c => c.studentId)
        );

        birthdayStudents.forEach(s => {
            if (!alreadyIssuedIds.has(s.id)) {
                newCoupons.push({
                    id: generateId(),
                    studentId: s.id,
                    description: `생일 축하 쿠폰 ${currentYear}`,
                    value: couponValue,
                    expiresAt: new Date(currentYear, currentMonth + 3, 0).toISOString()
                });
            }
        });

        if (newCoupons.length > 0 || validAppState.lastBirthdayCouponMonth !== currentMonth) {
            updateAppState(prev => {
                if (!prev || prev === 'error') return prev;
                return {
                    ...prev,
                    coupons: [...prev.coupons, ...newCoupons],
                    lastBirthdayCouponMonth: currentMonth
                };
            }, "생일 쿠폰 자동 발급");
        }
    }, [validAppState?.students, validAppState?.lastBirthdayCouponMonth, validAppState?.generalSettings.birthdayCouponValue, updateAppState]);


    if (appState === null) {
        return <AppLoader message="데이터를 불러오는 중..." />;
    }
    if (appState === 'error') {
        return <DataLoadError onReset={() => setAppState(getInitialData())} />;
    }
    
    const { students, missions, chessMissions, specialMissions, shopItems, transactions, coupons, shopSettings, shopCategories, groupSettings, generalSettings, eventSettings, tournamentData, tournamentSettings, chessMatches, gachaState } = appState;
    
    const handleTitleSave = () => {
        if (titleInputValue.trim() !== '') {
            updateAppState(prev => {
                if (prev === null || prev === 'error') return prev;
                return {
                    ...prev,
                    generalSettings: { ...prev.generalSettings, academyName: titleInputValue.trim() },
                };
            }, "학원명 변경");
        } else {
            setTitleInputValue(generalSettings.academyName);
        }
        setIsEditingTitle(false);
    };

    const handleNavigateToEvent = (student: Student) => {
        setEventTargetStudent(student);
        setView('event');
    };

    const handleAddTransaction = (studentId: string, type: Transaction['type'], description: string, amount: number, eventDetails?: { eventMonth: string }) => {
        const studentName = students.find(s => s.id === studentId)?.name || studentId;
        updateAppState(prevState => {
            if (prevState === null || prevState === 'error') return prevState;
            const student = prevState.students.find(s => s.id === studentId);
            if (!student) return prevState;

            const stoneBalanceBefore = student.stones;
            // Capping stone count to maxStones
            const newStones = Math.max(0, Math.min(stoneBalanceBefore + amount, student.maxStones));

            // FIX: Even if stone count doesn't change (at cap), we must record the transaction 
            // so completion counts and activity history are updated correctly.
            const newTransaction: Transaction = {
                id: generateId(), studentId, type, description, amount,
                timestamp: new Date().toISOString(), status: 'active',
                stoneBalanceBefore: stoneBalanceBefore,
                stoneBalanceAfter: newStones,
            };
            if (eventDetails?.eventMonth) newTransaction.eventMonth = eventDetails.eventMonth;
            
            return {
                ...prevState,
                students: prevState.students.map(s => s.id === studentId ? { ...s, stones: newStones } : s),
                transactions: [...prevState.transactions, newTransaction]
            };
        }, `${studentName}: ${description}`);
    };

    const handlePurchase = (studentId: string, description: string, totalCost: number, couponDeduction: number, finalStoneCost: number) => {
        updateAppState(prev => {
            if (!prev || prev === 'error') return prev;
            const student = prev.students.find(s => s.id === studentId);
            if (!student) return prev;

            const stoneBalanceBefore = student.stones;
            const newStones = stoneBalanceBefore - finalStoneCost;

            let remainingDeduction = couponDeduction;
            const sortedCoupons = [...prev.coupons].sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime());
            const usedCouponsInfo: UsedCouponInfo[] = [];

            const finalCoupons = sortedCoupons.filter(c => {
                if (c.studentId === studentId && remainingDeduction > 0) {
                    const valueToUse = Math.min(c.value, remainingDeduction);
                    usedCouponsInfo.push({
                        id: c.id,
                        description: c.description,
                        valueUsed: valueToUse,
                        originalExpiresAt: c.expiresAt
                    });
                    remainingDeduction -= valueToUse;
                    
                    if (c.value > valueToUse) {
                        c.value -= valueToUse;
                        return true; 
                    }
                    return false; 
                }
                return true;
            });

            const newTransaction: Transaction = {
                id: generateId(), studentId, type: 'purchase', description, amount: -finalStoneCost,
                timestamp: new Date().toISOString(), status: 'active',
                stoneBalanceBefore, stoneBalanceAfter: newStones,
                couponsUsed: usedCouponsInfo
            };

            return {
                ...prev,
                students: prev.students.map(s => s.id === studentId ? { ...s, stones: newStones } : s),
                coupons: finalCoupons,
                transactions: [...prev.transactions, newTransaction]
            };
        }, `상품 구매(${studentId}): ${description}`);
    };

    const handleRevertTransaction = (transactionId: string, isDelete: boolean = false) => {
        const actionLabel = isDelete ? "내역 삭제" : "내역 취소";
        updateAppState(prev => {
            if (!prev || prev === 'error') return prev;
            const tx = prev.transactions.find(t => t.id === transactionId);
            if (!tx) return prev;

            const student = prev.students.find(s => s.id === tx.studentId);
            let newStudents = prev.students;
            
            if (student && tx.status === 'active') {
                const revertAmount = -tx.amount; 
                const newStones = Math.max(0, Math.min(student.stones + revertAmount, student.maxStones));
                newStudents = prev.students.map(s => s.id === tx.studentId ? { ...s, stones: newStones } : s);
            }

            let newCoupons = prev.coupons;
            if (tx.status === 'active' && tx.type === 'purchase' && tx.couponsUsed && tx.couponsUsed.length > 0) {
                const restoredCoupons: Coupon[] = tx.couponsUsed.map(uc => ({
                    id: uc.id,
                    studentId: tx.studentId,
                    description: uc.description,
                    value: uc.valueUsed,
                    expiresAt: uc.originalExpiresAt
                }));
                newCoupons = [...prev.coupons, ...restoredCoupons];
            }

            const newTransactions = isDelete 
                ? prev.transactions.filter(t => t.id !== transactionId)
                : prev.transactions.map(t => t.id === transactionId ? { ...t, status: 'cancelled' as const } : t);

            return {
                ...prev,
                students: newStudents,
                coupons: newCoupons,
                transactions: newTransactions
            };
        }, `${actionLabel}: ${transactionId}`);
    };

    const handleBulkAddTransaction = (studentIds: string[], description: string, amount: number) => {
        updateAppState(prev => {
            if (prev === null || prev === 'error') return prev;
            const newTxs: Transaction[] = [];
            const newStudents = prev.students.map(s => {
                if (studentIds.includes(s.id)) {
                    const before = s.stones;
                    const after = Math.max(0, Math.min(before + amount, s.maxStones));
                    
                    newTxs.push({
                        id: generateId(), studentId: s.id, type: 'adjustment', description, amount,
                        timestamp: new Date().toISOString(), status: 'active',
                        stoneBalanceBefore: before, stoneBalanceAfter: after
                    });
                    return { ...s, stones: after };
                }
                return s;
            });
            return { ...prev, students: newStudents, transactions: [...prev.transactions, ...newTxs] };
        }, `일괄 지급: ${description}`);
    };

    const handleGachaPick = (studentId: string, pickedNumber: number, monthIdentifier: string) => {
        let currentGachaData = gachaState[monthIdentifier];
        let newMap = currentGachaData?.prizeMap;

        if (!currentGachaData || !currentGachaData.prizeMap || currentGachaData.prizeMap.length === 0) {
            const counts = eventSettings.gachaPrizeCounts;
            const map: number[] = [];
            (['first', 'second', 'third', 'fourth', 'fifth'] as const).forEach((key, idx) => {
                for(let i=0; i < counts[key]; i++) map.push(idx + 1);
            });
            while(map.length < 100) map.push(5);
            for (let i = map.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [map[i], map[j]] = [map[j], map[i]];
            }
            newMap = map;
            currentGachaData = { prizeMap: newMap, pickedNumbers: {} };
        }

        const prizeTier = newMap![pickedNumber - 1];
        const prizeKey = ['first', 'second', 'third', 'fourth', 'fifth'][prizeTier - 1] as keyof typeof eventSettings.gachaPrizes;
        const prizeAmount = eventSettings.gachaPrizes[prizeKey];

        updateAppState(prev => {
            if (!prev || prev === 'error') return prev;
            const student = prev.students.find(s => s.id === studentId);
            if (!student) return prev;
            const beforeStones = student.stones;
            const afterStones = Math.max(0, Math.min(beforeStones + prizeAmount, student.maxStones));

            const newTransaction: Transaction = {
                id: generateId(), studentId, type: 'gacha',
                description: `스톤 뽑기판 ${prizeTier}등 (#${pickedNumber})`,
                amount: prizeAmount, timestamp: new Date().toISOString(), status: 'active',
                stoneBalanceBefore: beforeStones, stoneBalanceAfter: afterStones,
                eventMonth: monthIdentifier
            };

            const updatedGachaState = {
                ...prev.gachaState,
                [monthIdentifier]: {
                    prizeMap: newMap!,
                    pickedNumbers: {
                        ...(prev.gachaState[monthIdentifier]?.pickedNumbers || {}),
                        [studentId]: pickedNumber
                    }
                }
            };

            return {
                ...prev,
                students: prev.students.map(s => s.id === studentId ? { ...s, stones: afterStones } : s),
                transactions: [...prev.transactions, newTransaction],
                gachaState: updatedGachaState
            };
        }, `뽑기: ${pickedNumber}번`);

        return { pickedNumber, prizeTier, prizeAmount };
    };

    const handleCancelEventEntry = (studentId: string, monthIdentifier: string) => {
        updateAppState(prev => {
            if (!prev || prev === 'error') return prev;
            const tx = prev.transactions.find(t => 
                t.studentId === studentId && 
                t.eventMonth === monthIdentifier && 
                t.status === 'active' &&
                (t.type === 'gacha' || t.type === 'roulette')
            );
            if (!tx) return prev;
            const student = prev.students.find(s => s.id === studentId);
            const reverseAmount = -tx.amount;
            let newStudents = prev.students;
            if (student) {
                const newStones = Math.max(0, student.stones + reverseAmount);
                newStudents = prev.students.map(s => s.id === studentId ? { ...s, stones: newStones } : s);
            }
            const newTransactions = prev.transactions.map(t => 
                t.id === tx.id ? { ...t, status: 'cancelled' as const, description: `${t.description} (취소됨)` } : t
            );
            const newGachaState = { ...prev.gachaState };
            if (prev.gachaState[monthIdentifier]) {
                const newPicked = { ...prev.gachaState[monthIdentifier].pickedNumbers };
                delete newPicked[studentId];
                newGachaState[monthIdentifier] = { ...prev.gachaState[monthIdentifier], pickedNumbers: newPicked };
            }
            return { ...prev, students: newStudents, transactions: newTransactions, gachaState: newGachaState };
        }, "이벤트 참여 취소");
    };

    const handleRecordChessMatch = (whiteId: string, blackId: string, result: 'white' | 'black' | 'draw') => {
        const getPName = (id: string) => {
            if (id === 'non-chess-player') return '비체스반';
            return students.find(s => s.id === id)?.name || id;
        };

        updateAppState(prev => {
            if (!prev || prev === 'error') return prev;
            
            const whitePlayer = prev.students.find(s => s.id === whiteId) || { id: 'non-chess-player', chessRating: prev.generalSettings.nonChessPlayerRating, name: '비체스반' };
            const blackPlayer = prev.students.find(s => s.id === blackId) || { id: 'non-chess-player', chessRating: prev.generalSettings.nonChessPlayerRating, name: '비체스반' };

            const { newWhiteRating, newBlackRating, ratingDeltaForWhite } = calculateNewElo(
                whitePlayer.chessRating || 1000,
                blackPlayer.chessRating || 1000,
                result,
                prev.generalSettings.eloKFactor
            );

            const newMatch: ChessMatch = {
                id: generateId(),
                timestamp: new Date().toISOString(),
                whitePlayerId: whiteId,
                blackPlayerId: blackId,
                result,
                whitePlayerNewRating: newWhiteRating,
                blackPlayerNewRating: newBlackRating,
                ratingDeltaForWhite,
                status: 'active'
            };

            const newStudents = prev.students.map(s => {
                if (s.id === whiteId) {
                    return { ...s, chessRating: newWhiteRating, chessGamesPlayed: (s.chessGamesPlayed || 0) + 1 };
                }
                if (s.id === blackId) {
                    return { ...s, chessRating: newBlackRating, chessGamesPlayed: (s.chessGamesPlayed || 0) + 1 };
                }
                return s;
            });

            return {
                ...prev,
                students: newStudents,
                chessMatches: [newMatch, ...prev.chessMatches]
            };
        }, `체스 대국: ${getPName(whiteId)} vs ${getPName(blackId)}`);
    };

    const handleCancelChessMatch = (matchId: string) => {
        updateAppState(prev => {
            if (!prev || prev === 'error') return prev;
            const match = prev.chessMatches.find(m => m.id === matchId);
            if (!match || match.status === 'cancelled') return prev;

            const newStudents = prev.students.map(s => {
                if (s.id === match.whitePlayerId) {
                    const beforeRating = match.whitePlayerNewRating - match.ratingDeltaForWhite;
                    return { ...s, chessRating: beforeRating, chessGamesPlayed: Math.max(0, (s.chessGamesPlayed || 0) - 1) };
                }
                if (s.id === match.blackPlayerId) {
                    const beforeRating = match.blackPlayerNewRating + match.ratingDeltaForWhite;
                    return { ...s, chessRating: beforeRating, chessGamesPlayed: Math.max(0, (s.chessGamesPlayed || 0) - 1) };
                }
                return s;
            });

            return {
                ...prev,
                students: newStudents,
                chessMatches: prev.chessMatches.map(m => m.id === matchId ? { ...m, status: 'cancelled' as const } : m)
            };
        }, "체스 대국 기록 취소");
    };

    return (
        <div className="app-container">
            <header className="header">
                <div className="header-title-group">
                    {isEditingTitle ? (
                         <input type="text" className="title-edit-input" value={titleInputValue} onChange={(e) => setTitleInputValue(e.target.value)} onBlur={handleTitleSave} onKeyDown={(e) => e.key === 'Enter' && handleTitleSave()} autoFocus />
                    ) : (
                        <h1 onClick={() => setIsEditingTitle(true)} style={{cursor: 'pointer'}}>
                            {generalSettings.academyName}
                            <span className="title-edit-icon">✏️</span>
                        </h1>
                    )}
                    {isDemo && <span className="demo-badge">체험 모드</span>}
                </div>
                
                <div className="view-toggle">
                     <button className={`toggle-btn ${view === 'student' ? 'active' : ''}`} onClick={() => setView('student')}>바둑반</button>
                     <button className={`toggle-btn ${view === 'chess' ? 'active' : ''}`} onClick={() => setView('chess')}>체스반</button>
                     <button className={`toggle-btn ${view === 'tournament' ? 'active' : ''}`} onClick={() => setView('tournament')}>대회</button>
                     <button className={`toggle-btn ${view === 'event' ? 'active' : ''}`} onClick={() => setView('event')}>이벤트</button>
                     <button className={`toggle-btn ${view === 'admin' ? 'active' : ''}`} onClick={() => setView('admin')}>관리자</button>
                     {user.uid === 'master' && <button className={`toggle-btn ${view === 'master' ? 'active' : ''}`} onClick={() => setView('master')}>마스터</button>}
                </div>

                <div className="header-controls" style={{ display: 'flex', alignItems: 'center' }}>
                    <button 
                        className="btn-sm" 
                        onClick={handleUndo} 
                        disabled={history.length === 0}
                        title={`직전 작업 되돌리기: ${history[0]?.description || ""}`}
                        style={{marginRight: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.4rem 0.8rem', border: '1px solid var(--primary-color)', color: 'var(--primary-color)'}}
                    >
                        ↩️
                    </button>
                    <button className="settings-btn" onClick={() => setIsSettingsModalOpen(true)} title="계정 설정">⚙️</button>
                </div>
            </header>

            <main className="main-content">
                {view === 'student' && (
                    <StudentView 
                        students={students} coupons={coupons} transactions={transactions}
                        groupSettings={groupSettings} generalSettings={generalSettings} eventSettings={eventSettings}
                        onStudentClick={(s) => { setSelectedStudent(s); setIsSidebarOpen(true); }}
                        onNavigateToEvent={handleNavigateToEvent} setView={setView}
                    />
                )}
                
                {view === 'admin' && (
                    <AdminPanel 
                        students={students} missions={missions} chessMissions={chessMissions} specialMissions={specialMissions} shopItems={shopItems} shopSettings={shopSettings} shopCategories={shopCategories} groupSettings={groupSettings} generalSettings={generalSettings}
                        setMissions={v => updateAppState(p => p && p!=='error' ? {...p, missions: typeof v==='function'?v(p.missions):v} : p, "미션 목록 수정")}
                        setChessMissions={v => updateAppState(p => p && p!=='error' ? {...p, chessMissions: typeof v==='function'?v(p.chessMissions):v} : p, "체스 미션 수정")}
                        setSpecialMissions={v => updateAppState(p => p && p!=='error' ? {...p, specialMissions: typeof v==='function'?v(p.specialMissions):v} : p, "특별 미션 수정")}
                        setShopItems={v => updateAppState(p => p && p!=='error' ? {...p, shopItems: typeof v==='function'?v(p.shopItems):v} : p, "상품 목록 수정")}
                        setShopSettings={v => updateAppState(p => p && p!=='error' ? {...p, shopSettings: typeof v==='function'?v(p.shopSettings):v} : p, "상점 설정 수정")}
                        setShopCategories={v => updateAppState(p => p && p!=='error' ? {...p, shopCategories: typeof v==='function'?v(p.shopCategories):v} : p, "카테고리 수정")}
                        onSaveStudent={(d, id) => {
                            updateAppState(prev => {
                                if (!prev || prev === 'error') return prev;
                                const { group } = getGroupForRank(d.rank);
                                const maxStones = prev.groupSettings[group]?.maxStones || 40;
                                if (id) {
                                    return { ...prev, students: prev.students.map(s => s.id === id ? { ...s, ...d, group, maxStones } : s) };
                                } else {
                                    return { ...prev, students: [...prev.students, { ...d, id: generateId(), group, maxStones, stones: 0, chessRating: 1000, chessGamesPlayed: 0 }] };
                                }
                            }, id ? "학생 수정" : "학생 추가");
                        }}
                        onDeleteStudent={(id) => updateAppState(p => p && p!=='error' ? {...p, students: p.students.filter(s => s.id !== id)} : p, "학생 삭제")}
                        onUpdateGroupSettings={(g) => updateAppState(p => p && p!=='error' ? {...p, groupSettings: g} : p, "그룹 설정 변경")}
                        onUpdateGeneralSettings={(g) => updateAppState(p => p && p!=='error' ? {...p, generalSettings: g} : p, "일반 설정 변경")}
                        onBulkAddTransaction={handleBulkAddTransaction}
                        onBulkUpdateStudents={(ids, updates) => updateAppState(p => {
                            if (!p || p === 'error') return p;
                            return { ...p, students: p.students.map(s => ids.includes(s.id) ? { ...s, ...updates, ...(updates.rank ? {group: getGroupForRank(updates.rank).group} : {}) } : s) };
                        }, "학생 일괄 수정")}
                        onAddCoupon={(c) => updateAppState(p => p && p!=='error' ? {...p, coupons: [...p.coupons, { ...c, id: generateId() }]} : p, "쿠폰 개별 발급")}
                        onImportStudents={(d, mode) => { /* simplified */ }}
                        onImportMissions={(d, mode) => { /* simplified */ }}
                        onImportShopItems={(d, mode) => { /* simplified */ }}
                    />
                )}

                {view === 'event' && (
                    <EventView 
                        students={students} transactions={transactions} eventSettings={eventSettings} gachaStates={gachaState} targetStudent={eventTargetStudent}
                        onClearTargetStudent={() => setEventTargetStudent(null)}
                        setEventSettings={v => updateAppState(p => p && p!=='error' ? {...p, eventSettings: typeof v==='function'?v(p.eventSettings):v} : p, "이벤트 설정 변경")}
                        onAddTransaction={(sid, type, desc, amt, evt) => handleAddTransaction(sid, type, desc, amt, evt)}
                        onGachaPick={handleGachaPick}
                        onCancelEventEntry={handleCancelEventEntry}
                    />
                )}

                {view === 'tournament' && (
                    <TournamentView
                        students={students} data={tournamentData}
                        setData={v => updateAppState(p => p && p!=='error' ? {...p, tournamentData: typeof v==='function'?v(p.tournamentData):v} : p, "대회 데이터 변경")}
                        settings={tournamentSettings}
                        setSettings={v => updateAppState(p => p && p!=='error' ? {...p, tournamentSettings: typeof v==='function'?v(p.tournamentSettings):v} : p, "대회 설정 변경")}
                        onBulkAddTransaction={handleBulkAddTransaction}
                    />
                )}
                
                {view === 'chess' && (
                    <ChessPanel
                        students={students} matches={chessMatches} transactions={transactions} generalSettings={generalSettings} missions={missions} chessMissions={chessMissions}
                        onRecordMatch={handleRecordChessMatch}
                        onCancelMatch={handleCancelChessMatch}
                        onChessAttendance={(id) => handleAddTransaction(id, 'chess_attendance', '체스반 출석', generalSettings.chessAttendanceValue)}
                        onAddTransaction={handleAddTransaction}
                        onUpdateGeneralSettings={(g) => updateAppState(p => p && p!=='error' ? {...p, generalSettings: g} : p, "체스 설정 변경")}
                        onUpdateChessRating={(id, r) => updateAppState(p => p && p!=='error' ? {...p, students: p.students.map(s => s.id === id ? {...s, chessRating: r} : s)} : p, "체스 레이팅 수정")}
                        onChessAbsencePenalty={(id) => handleAddTransaction(id, 'adjustment', '체스반 결석', -10)}
                    />
                )}

                {view === 'master' && user.uid === 'master' && <MasterPanel user={user} />}
            </main>

            <QuickMenuSidebar 
                student={selectedStudent} students={students} missions={missions} specialMissions={specialMissions} shopItems={shopItems} shopSettings={shopSettings} shopCategories={shopCategories} coupons={coupons} transactions={transactions}
                isOpen={isSidebarOpen} groupSettings={groupSettings} generalSettings={generalSettings}
                onClose={() => setIsSidebarOpen(false)}
                onAddTransaction={handleAddTransaction}
                onUpdateTransaction={(t) => updateAppState(p => p && p!=='error' ? {...p, transactions: p.transactions.map(tx => tx.id === t.id ? t : tx)} : p, "기록 수정")}
                onDeleteCoupon={(id) => updateAppState(p => p && p!=='error' ? {...p, coupons: p.coupons.filter(c => c.id !== id)} : p, "쿠폰 삭제")}
                onPurchase={handlePurchase}
                onCancelTransaction={(tid) => handleRevertTransaction(tid, false)}
                onDeleteTransaction={(tid) => handleRevertTransaction(tid, true)}
                onTransferStones={(from, to, amount) => {
                    handleAddTransaction(from, 'adjustment', '스톤 이체 (보냄)', -amount);
                    handleAddTransaction(to, 'adjustment', '스톤 이체 (받음)', amount);
                }}
                onUpdateJosekiProgress={(id, prog) => updateAppState(p => p && p!=='error' ? {...p, students: p.students.map(s => s.id === id ? {...s, josekiProgress: prog} : s)} : p, "정석 진도 변경")}
                onCompleteJosekiMission={(id) => handleAddTransaction(id, 'joseki_mission', '정석 외우기 완료', generalSettings.josekiMissionValue)}
            />
            {isSettingsModalOpen && <AccountSettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} onLogout={onLogout} user={user} />}
        </div>
    );
};
