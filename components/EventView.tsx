
import React, { useState, useMemo, useEffect } from 'react';
import { useDateKey } from '../hooks/useDateKey';
import type { Student, Transaction, EventSettings, GachaState, GachaData, EventMonthlyStats } from '../types';
import { ConfirmationModal } from './modals/ConfirmationModal';
import { EventSettingsModal } from './modals/EventSettingsModal';

interface EventViewProps {
    students: Student[];
    transactions: Transaction[];
    eventMonthlyStats?: EventMonthlyStats;
    eventSettings: EventSettings;
    gachaStates: GachaState;
    targetStudent: Student | null;
    /** 지난달 이벤트 버튼으로 진입 시 '지난 달' 탭 자동 선택 */
    initialMonth?: 'current' | 'previous' | null;
    onClearTargetStudent: () => void;
    onInitialMonthApplied?: () => void;
    setEventSettings: React.Dispatch<React.SetStateAction<EventSettings>>;
    onAddTransaction: (studentId: string, type: 'roulette' | 'gacha', description: string, amount: number, eventDetails?: { eventMonth: string }) => void;
    onGachaPick: (studentId: string, pickedNumber: number, monthIdentifier: string) => { pickedNumber: number, prizeTier: number, prizeAmount: number } | undefined;
    onCancelEventEntry: (studentId: string, monthIdentifier: string) => void;
}

interface StudentWithStats extends Student {
    missionsThisMonth: number;
    penaltyCount: number;
    isEligible: boolean;
    ineligibilityReason?: string;
    eventParticipation: { type: 'roulette' | 'gacha', amount: number } | null;
}

interface GachaRevealModalProps {
    result: {
        student: Student;
        prizeTier: number;
        prizeAmount: number;
        pickedNumber: number;
    };
    onClose: () => void;
}

const GachaRevealModal = ({ result, onClose }: GachaRevealModalProps) => {
    const [stage, setStage] = useState<'folded' | 'unfolding-h' | 'open'>('folded');
    const [showStamp, setShowStamp] = useState(false);

    useEffect(() => {
        const t1 = setTimeout(() => setStage('unfolding-h'), 300);
        const t2 = setTimeout(() => setStage('open'), 800);
        const t3 = setTimeout(() => setShowStamp(true), 1300);

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
        };
    }, []);

    return (
        <div className="gacha-reveal-overlay">
            <div className="gacha-ticket-wrapper">
                <div className={`gacha-ticket ${stage}`}>
                    <div className="gacha-content">
                        <div style={{ fontSize: '1.2rem', color: '#8b4513', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                            스톤 뽑기판 #{result.pickedNumber}
                        </div>
                        <div className={`gacha-rank-stamp ${showStamp ? 'stamped' : ''}`}>
                            {result.prizeTier}등
                        </div>
                        <div className="gacha-prize-text">
                            축하합니다!<br/>
                            <span style={{ color: '#d32f2f', fontSize: '1.8rem' }}>{result.prizeAmount}</span> 스톤
                        </div>
                        <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
                            {result.student.name} 학생
                        </div>
                        {showStamp && (
                            <button className="gacha-close-btn" onClick={onClose} autoFocus>
                                확인
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const GachaBoard = ({ gachaData, gachaResult, eventSettings, onCellClick, pickingStudentId, remainingPrizes }: { 
    gachaData: GachaData, 
    gachaResult: { pickedNumber: number, prizeTier: number } | null, 
    eventSettings: EventSettings, 
    onCellClick: (num: number) => void, 
    pickingStudentId: string | null,
    remainingPrizes: Record<keyof EventSettings['gachaPrizeCounts'], number> 
}) => {
    const pickedSet = useMemo(() => new Set(Object.values(gachaData.pickedNumbers).map(Number)), [gachaData.pickedNumbers]);

    const getTierForNumber = (num: number): number | string => {
        if (!gachaData.prizeMap || gachaData.prizeMap.length === 0) return '?';
        return gachaData.prizeMap[num - 1];
    };

    return (
        <div className="gacha-layout-row">
            <div className="gacha-board-wrapper">
                <h3 style={{marginBottom: '1rem', color: 'var(--primary-color)', textAlign: 'center'}}>스톤 뽑기판</h3>
                <div className={`gacha-board ${gachaResult ? 'reveal' : ''}`}>
                    {Array.from({ length: 100 }, (_, i) => i + 1).map(num => {
                        const isPicked = pickedSet.has(num);
                        const isClickable = !isPicked && !!pickingStudentId;

                        return (
                            <div
                                key={num}
                                className={`gacha-cell ${isPicked ? 'picked' : ''} ${gachaResult?.pickedNumber === num ? 'result' : ''}`}
                                onClick={isClickable ? () => onCellClick(num) : undefined}
                                role={isClickable ? 'button' : undefined}
                                tabIndex={isClickable ? 0 : -1}
                                onKeyPress={isClickable ? (e) => e.key === 'Enter' && onCellClick(num) : undefined}
                            >
                                {isPicked ? `${getTierForNumber(num)}등` : num}
                            </div>
                        );
                    })}
                </div>
            </div>
            
            <div className="gacha-prize-info">
                <h3>🎉 상품 안내</h3>
                <ul className="prize-list">
                    <li className="prize-item rank-1">
                        <span className="prize-rank">1등</span>
                        <span className="prize-amount">{eventSettings.gachaPrizes.first} 스톤</span>
                        <span className="prize-count">{remainingPrizes.first}개 남음</span>
                    </li>
                    <li className="prize-item rank-2">
                        <span className="prize-rank">2등</span>
                        <span className="prize-amount">{eventSettings.gachaPrizes.second} 스톤</span>
                        <span className="prize-count">{remainingPrizes.second}개 남음</span>
                    </li>
                    <li className="prize-item rank-3">
                        <span className="prize-rank">3등</span>
                        <span className="prize-amount">{eventSettings.gachaPrizes.third} 스톤</span>
                        <span className="prize-count">{remainingPrizes.third}개 남음</span>
                    </li>
                    <li className="prize-item rank-4">
                        <span className="prize-rank">4등</span>
                        <span className="prize-amount">{eventSettings.gachaPrizes.fourth} 스톤</span>
                        <span className="prize-count">{remainingPrizes.fourth}개 남음</span>
                    </li>
                    <li className="prize-item rank-5">
                        <span className="prize-rank">5등</span>
                        <span className="prize-amount">{eventSettings.gachaPrizes.fifth} 스톤</span>
                        <span className="prize-count">{remainingPrizes.fifth}개 남음</span>
                    </li>
                </ul>
                
                {pickingStudentId && (
                    <div className="gacha-instruction-message">
                        👇 번호를 선택하세요!
                    </div>
                )}
            </div>
        </div>
    );
}

export const EventView = (props: EventViewProps) => {
    const { students, transactions, eventMonthlyStats, eventSettings, setEventSettings, onAddTransaction, gachaStates, onGachaPick, onCancelEventEntry, targetStudent, initialMonth, onClearTargetStudent, onInitialMonthApplied } = props;
    
    const dateKey = useDateKey();
    const [selectedMonth, setSelectedMonth] = useState<'current' | 'previous'>('current');
    const [resultMessage, setResultMessage] = useState<{ student: StudentWithStats; text: string; } | null>(null);
    const [revealResult, setRevealResult] = useState<{ student: Student; prizeTier: number; prizeAmount: number; pickedNumber: number } | null>(null);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [pickingStudentId, setPickingStudentId] = useState<string | null>(null);

    const { startOfMonth, endOfMonth, monthIdentifier, monthLabel } = useMemo(() => {
        const now = new Date();
        const targetDate = selectedMonth === 'current' 
            ? now 
            : new Date(now.getFullYear(), now.getMonth() - 1, 1);
        
        const year = targetDate.getFullYear();
        const month = targetDate.getMonth();

        const startOfMonth = new Date(year, month, 1);
        const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);
        const monthIdentifier = `${year}-${month}`;
        const monthLabel = `${month + 1}월`;

        return { startOfMonth, endOfMonth, monthIdentifier, monthLabel };
    }, [selectedMonth, dateKey]);

    const studentStats: StudentWithStats[] = useMemo(() => {
        return students.map(student => {
            const storedForMonth = eventMonthlyStats?.[monthIdentifier]?.[student.id];
            const missionsFromTx = transactions.filter(t => 
                t.studentId === student.id &&
                (t.type === 'mission' || t.type === 'attendance' || t.type === 'special_mission' || t.type === 'mission_adjustment') &&
                new Date(t.timestamp) >= startOfMonth &&
                new Date(t.timestamp) <= endOfMonth &&
                t.status === 'active'
            ).reduce((acc, t) => {
                if (t.type === 'mission_adjustment') {
                    return acc + (t.missionCountDelta || 0);
                }
                return acc + 1;
            }, 0);
            const missionsThisMonth = storedForMonth?.missions !== undefined ? storedForMonth.missions : missionsFromTx;

            const penaltiesFromTx = transactions.filter(t =>
                t.studentId === student.id &&
                t.type === 'penalty' &&
                new Date(t.timestamp) >= startOfMonth &&
                new Date(t.timestamp) <= endOfMonth
            ).length;
            const penaltyCount = storedForMonth?.penalties !== undefined ? storedForMonth.penalties : penaltiesFromTx;
            
            const eventTx = transactions.find(t => {
                if (t.studentId !== student.id || (t.type !== 'roulette' && t.type !== 'gacha') || t.status === 'cancelled') {
                    return false;
                }
                if (t.eventMonth) {
                    return t.eventMonth === monthIdentifier;
                }
                const txDate = new Date(t.timestamp);
                return txDate >= startOfMonth && txDate <= endOfMonth;
            });

            const eventParticipation = eventTx && (eventTx.type === 'roulette' || eventTx.type === 'gacha') ? { type: eventTx.type, amount: eventTx.amount } : null;

            const minReq = eventSettings.minMissionsToSpin ?? 10;
            const maxAllowedPenalties = eventSettings.maxPenalties ?? 999;

            const missionsSufficient = missionsThisMonth >= minReq;
            const penaltyLimitOk = penaltyCount < maxAllowedPenalties;
            const isEligible = missionsSufficient && penaltyLimitOk;

            let ineligibilityReason = '';
            if (!missionsSufficient) {
                ineligibilityReason = `${minReq - missionsThisMonth}회 미션 부족`;
            } else if (!penaltyLimitOk) {
                ineligibilityReason = `감점 ${penaltyCount}회 (최대 ${maxAllowedPenalties}회)`;
            }

            return {
                ...student,
                missionsThisMonth,
                penaltyCount,
                isEligible,
                ineligibilityReason,
                eventParticipation
            };
        }).sort((a, b) => a.name.localeCompare(b.name));
    }, [students, transactions, eventMonthlyStats, eventSettings.minMissionsToSpin, eventSettings.maxPenalties, startOfMonth, endOfMonth, monthIdentifier]);
    
    // 지난달 이벤트 버튼으로 진입 시 '지난 달' 탭 선택
    useEffect(() => {
        if (targetStudent && initialMonth === 'previous') {
            setSelectedMonth('previous');
            onInitialMonthApplied?.();
        }
    }, [targetStudent, initialMonth, onInitialMonthApplied]);

    useEffect(() => {
        if (targetStudent) {
            const stats = studentStats.find(s => s.id === targetStudent.id);
            if (stats && stats.isEligible && !stats.eventParticipation) {
                setPickingStudentId(targetStudent.id);
            } else if (stats && !stats.isEligible) {
                alert(`${stats.name} 학생은 이벤트 참여 조건(${stats.ineligibilityReason})을 만족하지 못했습니다.`);
                onClearTargetStudent();
            } else if (stats?.eventParticipation) {
                alert(`${stats.name} 학생은 이미 이벤트에 참여했습니다.`);
                onClearTargetStudent();
            }
        }
    }, [targetStudent, studentStats, onClearTargetStudent]);

    const activeGachaData = useMemo(() => {
        return gachaStates[monthIdentifier] || { prizeMap: [], pickedNumbers: {} };
    }, [gachaStates, monthIdentifier]);
    
    const remainingPrizes = useMemo(() => {
        const initialCounts = { ...eventSettings.gachaPrizeCounts };
        const tierMap: { [key: number]: keyof EventSettings['gachaPrizeCounts'] } = { 1: 'first', 2: 'second', 3: 'third', 4: 'fourth', 5: 'fifth' };

        if (activeGachaData.prizeMap.length > 0) {
            Object.values(activeGachaData.pickedNumbers).forEach(pickedNumber => {
                const prizeTier = activeGachaData.prizeMap[Number(pickedNumber) - 1];
                if (prizeTier in tierMap) {
                    const tierKey = tierMap[prizeTier];
                    initialCounts[tierKey] = Math.max(0, initialCounts[tierKey] - 1);
                }
            });
        }
        return initialCounts;
    }, [activeGachaData, eventSettings.gachaPrizeCounts]);

    const handleAction = (student: StudentWithStats) => {
        if (student.eventParticipation || !student.isEligible) return;
        setPickingStudentId(student.id);
    };
    
    const handleCellClick = (pickedNumber: number) => {
        if (!pickingStudentId) return;
    
        const student = studentStats.find(s => s.id === pickingStudentId);
        if (!student) return;
    
        const pickResult = onGachaPick(pickingStudentId, pickedNumber, monthIdentifier);
        
        if (pickResult) {
            setRevealResult({
                student,
                prizeTier: pickResult.prizeTier,
                prizeAmount: pickResult.prizeAmount,
                pickedNumber: pickResult.pickedNumber
            });
        }
        
        setPickingStudentId(null);
        onClearTargetStudent();
    };

    const handleRevealClose = () => {
        setRevealResult(null);
    };

    const handleConfirmCancel = (student: StudentWithStats) => {
        setResultMessage({
            student,
            text: `${student.name} 학생의 ${student.eventParticipation?.type === 'gacha' ? '뽑기' : '룰렛'} 참여 기록을 정말 취소하시겠습니까? 지급된 스톤이 회수됩니다.`
        })
    }

    const onConfirmCancel = (studentId: string) => {
        onCancelEventEntry(studentId, monthIdentifier);
        setResultMessage(null);
    }

    return (
        <>
        <div className="event-view-container">
            <div className="gacha-game-section">
                <GachaBoard 
                    gachaData={activeGachaData} 
                    gachaResult={null} 
                    eventSettings={eventSettings} 
                    onCellClick={handleCellClick} 
                    pickingStudentId={pickingStudentId} 
                    remainingPrizes={remainingPrizes} 
                />
            </div>
            
            <div className="event-student-list">
                <div style={{padding: '1rem', borderBottom: '1px solid #eee', background: '#f8f9fa'}}>
                     <div style={{display: 'flex', justifyContent: 'center', marginBottom: '0.5rem'}}>
                        <div className="view-toggle">
                            <button className={`toggle-btn ${selectedMonth === 'current' ? 'active' : ''}`} onClick={() => setSelectedMonth('current')}>이번 달</button>
                            <button className={`toggle-btn ${selectedMonth === 'previous' ? 'active' : ''}`} onClick={() => setSelectedMonth('previous')}>지난 달</button>
                        </div>
                    </div>
                    <div className="view-header-actions" style={{justifyContent: 'center', flexDirection: 'column', gap: '0.5rem'}}>
                        <h3 style={{margin: 0}}>{monthLabel} 참여 현황</h3>
                        <button className="btn" style={{width: '100%'}} onClick={() => setIsSettingsModalOpen(true)}>이벤트 설정</button>
                    </div>
                     <p style={{textAlign: 'center', fontSize: '0.8rem', color: '#666', marginTop: '0.5rem'}}>
                        조건: 미션 {eventSettings.minMissionsToSpin ?? 10}회 / 감점 {eventSettings.maxPenalties ?? 3}회 미만
                    </p>
                </div>

                <ul className="eligible-student-list">
                    {studentStats.map(student => (
                        <li key={student.id} className="eligible-student-item">
                            <div className="student-info">
                                <span className="student-name" style={{fontWeight: 'bold', fontSize: '1.05rem'}}>{student.name}</span>
                                <small className="student-stats" style={{color: '#666'}}>미션 {student.missionsThisMonth}회 / 감점 {student.penaltyCount}회</small>
                            </div>
                            <div className="student-actions">
                                {student.eventParticipation ? (
                                    <>
                                        <span className="spin-result">
                                            🎉 {student.eventParticipation.amount}
                                        </span>
                                        <button className="btn-sm danger" onClick={() => handleConfirmCancel(student)}>취소</button>
                                    </>
                                ) : student.isEligible ? (
                                     student.id === pickingStudentId ? (
                                        <button className="btn-sm" onClick={() => { setPickingStudentId(null); onClearTargetStudent(); }}>
                                            선택 취소
                                        </button>
                                    ) : (
                                        <button 
                                            className="btn-sm primary"
                                            onClick={() => handleAction(student)}
                                            disabled={pickingStudentId !== null}
                                        >
                                            뽑기
                                        </button>
                                    )
                                ) : (
                                    <span style={{fontSize: '0.9rem', color: 'var(--danger-color)'}}>
                                        불가
                                    </span>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
        {isSettingsModalOpen && (
            <EventSettingsModal
                isOpen={isSettingsModalOpen}
                onClose={() => setIsSettingsModalOpen(false)}
                settings={eventSettings}
                onUpdateSettings={setEventSettings}
            />
        )}
        {revealResult && (
            <GachaRevealModal
                result={revealResult}
                onClose={handleRevealClose}
            />
        )}
        {resultMessage && (
            <ConfirmationModal
                message={resultMessage.text}
                actions={resultMessage.text.includes('취소') ? [
                    { text: '닫기', onClick: () => setResultMessage(null) },
                    { text: '취소 실행', className: 'danger', onClick: () => onConfirmCancel(resultMessage.student.id) }
                ] : [
                    { text: '확인', onClick: () => { setResultMessage(null); }, className: 'primary' }
                ]}
                onClose={() => { setResultMessage(null); }}
            />
        )}
        </>
    );
};
