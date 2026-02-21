import React, { useState, useMemo } from 'react';
import type { Student, Mission, Transaction } from '../../types';

interface ChessMissionSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    student: Student | null;
    studentMissions: Mission[];
    missionCompletionCounts: Map<string, number>;
    chessAttendanceToday: Set<string>;
    transactions: Transaction[];
    onChessAttendance: (studentId: string) => void;
    onAddTransaction: (studentId: string, type: Transaction['type'], description: string, amount: number) => void;
    onOpenPartialMission: (mission: Mission) => void;
}

export const ChessMissionSidebar = (props: ChessMissionSidebarProps) => {
    const {
        isOpen,
        onClose,
        student,
        studentMissions,
        missionCompletionCounts,
        chessAttendanceToday,
        transactions,
        onChessAttendance,
        onAddTransaction,
        onOpenPartialMission,
    } = props;

    const [penaltyAmount, setPenaltyAmount] = useState('');

    const monthlyPenaltyStats = useMemo(() => {
        if (!student) return { count: 0, total: 0 };
        const now = new Date();
        const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const penaltyTxs = transactions.filter(t =>
            t.studentId === student.id &&
            (t.type === 'penalty' || (t.type === 'adjustment' && t.amount < 0)) &&
            t.status === 'active' &&
            new Date(t.timestamp) >= firstOfThisMonth
        );
        return {
            count: penaltyTxs.length,
            total: Math.abs(penaltyTxs.reduce((sum, t) => sum + t.amount, 0))
        };
    }, [student, transactions]);

    const handleApplyPenalty = (e: React.FormEvent) => {
        e.preventDefault();
        const amount = parseInt(penaltyAmount, 10) || 0;
        if (!student || amount <= 0) {
            alert('차감할 점수를 입력해주세요.');
            return;
        }
        onAddTransaction(student.id, 'penalty', '예절 불량 감점', -amount);
        setPenaltyAmount('');
    };

    if (!student) return null;

    return (
        <>
            {isOpen && (
                <div className="sidebar-overlay" onClick={onClose} aria-hidden="true" />
            )}
            <div className={`chess-mission-sidebar ${isOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <h2>체스 미션 · {student.name}</h2>
                    <button type="button" className="close-btn" onClick={onClose} aria-label="닫기">×</button>
                </div>
                <div className="sidebar-content">
                    <p className="sidebar-subtitle"><strong>{student.name}</strong> 학생의 미션</p>
                    <ul className="mission-list chess-sidebar-mission-list">
                        {studentMissions.length > 0 ? studentMissions.map(mission => {
                            const completionsToday = missionCompletionCounts.get(mission.description) || 0;

                            if (mission.id === 'chess_attendance_mission') {
                                const hasAttended = chessAttendanceToday.has(student.id);
                                return (
                                    <li key={mission.id} className="mission-item chess-sidebar-mission-item">
                                        <span className="chess-sidebar-mission-desc">{mission.description}</span>
                                        <div className="mission-actions">
                                            {completionsToday > 0 && (
                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-color-secondary)' }}>
                                                    ({completionsToday}회)
                                                </span>
                                            )}
                                            <span className="mission-stones">+{mission.stones}</span>
                                            <button
                                                type="button"
                                                className="btn-sm primary"
                                                onClick={() => onChessAttendance(student.id)}
                                                disabled={hasAttended}
                                            >
                                                {hasAttended ? '완료' : '출석'}
                                            </button>
                                        </div>
                                    </li>
                                );
                            }

                            return (
                                <li key={mission.id} className="mission-item chess-sidebar-mission-item">
                                    <span className="chess-sidebar-mission-desc">{mission.description}</span>
                                    <div className="mission-actions">
                                        {completionsToday > 0 && (
                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-color-secondary)' }}>
                                                ({completionsToday}회)
                                            </span>
                                        )}
                                        <span className="mission-stones">+{mission.stones}</span>
                                        <button
                                            type="button"
                                            className="btn-sm"
                                            onClick={() => onOpenPartialMission(mission)}
                                            disabled={student.stones >= student.maxStones}
                                        >
                                            부분
                                        </button>
                                        <button
                                            type="button"
                                            className="btn-sm primary"
                                            onClick={() => onAddTransaction(student.id, 'mission', mission.description, mission.stones)}
                                            disabled={student.stones >= student.maxStones}
                                        >
                                            완료
                                        </button>
                                    </div>
                                </li>
                            );
                        }) : <p>체스반 미션이 없습니다.</p>}
                    </ul>
                    <div className="penalty-control-wrapper">
                        <span className="control-label-mini" style={{ color: 'var(--danger-color)' }}>예절 불량 감점</span>
                        <div className="penalty-mission-line">
                            <form onSubmit={handleApplyPenalty} className="penalty-form-inline">
                                <input
                                    type="number"
                                    placeholder="점수"
                                    className="penalty-input-sm"
                                    value={penaltyAmount}
                                    onChange={e => setPenaltyAmount(e.target.value)}
                                    min="1"
                                />
                                <button type="submit" className="btn-sm danger penalty-btn-sm">차감</button>
                            </form>
                            <div className="penalty-stats-text">
                                <span className="penalty-stats">
                                    이번달 감점: {monthlyPenaltyStats.count}회 / -{monthlyPenaltyStats.total}점
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};
