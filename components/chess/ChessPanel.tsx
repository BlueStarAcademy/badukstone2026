
import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Student, ChessMatch, Transaction, GeneralSettings, Mission } from '../../types';
import { ConfirmationModal, ActionButton } from '../modals/ConfirmationModal';
import { ChessSettingsModal } from './ChessSettingsModal';

interface ChessPanelProps {
    students: Student[];
    matches: ChessMatch[];
    transactions: Transaction[];
    generalSettings: GeneralSettings;
    missions: Mission[];
    chessMissions: Mission[];
    onRecordMatch: (whitePlayerId: string, blackPlayerId: string, result: 'white' | 'black' | 'draw') => void;
    onCancelMatch: (matchId: string) => void;
    onChessAttendance: (studentId: string) => void;
    onAddTransaction: (studentId: string, type: Transaction['type'], description: string, amount: number) => void;
    onUpdateGeneralSettings: (settings: GeneralSettings) => void;
    onUpdateChessRating: (studentId: string, newRating: number) => void;
    onChessAbsencePenalty: (studentId: string) => void;
}

export const ChessPanel = (props: ChessPanelProps) => {
    const { 
        students, matches, transactions, generalSettings, missions, chessMissions,
        onRecordMatch, onCancelMatch, onChessAttendance, onAddTransaction, 
        onUpdateGeneralSettings, onUpdateChessRating, onChessAbsencePenalty
    } = props;
    
    const [whiteToRecord, setWhiteToRecord] = useState<Student | null>(null);
    const [blackToRecord, setBlackToRecord] = useState<Student | null>(null);
    const [result, setResult] = useState<'white' | 'black' | 'draw'>('white');
    const [missionStudent, setMissionStudent] = useState<Student | null>(null);

    const [confirmation, setConfirmation] = useState<{ message: React.ReactNode; actions: ActionButton[] } | null>(null);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [editingState, setEditingState] = useState<{ studentId: string; rating: string } | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const [nonChessRatingInput, setNonChessRatingInput] = useState(String(Math.round(generalSettings.nonChessPlayerRating)));

    // Partial Score State
    const [partialMission, setPartialMission] = useState<Mission | null>(null);
    const [partialAmount, setPartialAmount] = useState('');

    // Penalty State
    const [isPenaltyModalOpen, setIsPenaltyModalOpen] = useState(false);
    const [penaltyAmount, setPenaltyAmount] = useState('');
    const [penaltyReason, setPenaltyReason] = useState('');

    useEffect(() => {
        const currentRating = String(Math.round(generalSettings.nonChessPlayerRating));
        if (currentRating !== nonChessRatingInput) {
            setNonChessRatingInput(currentRating);
        }
    }, [generalSettings.nonChessPlayerRating]);


    const NON_CHESS_PLAYER_ID = 'non-chess-player';

    const nonChessPlayer: Student = useMemo(() => ({
        id: NON_CHESS_PLAYER_ID,
        name: '비체스반',
        rank: '-',
        group: '-',
        stones: 0,
        maxStones: 0,
        status: '재원',
        birthday: '',
        takesChess: true,
        chessRating: generalSettings.nonChessPlayerRating,
        chessGamesPlayed: undefined
    }), [generalSettings.nonChessPlayerRating]);


    const chessStudents = useMemo(() => {
        return students
            .filter(s => s.takesChess && s.status === '재원')
            .sort((a, b) => (b.chessRating || 0) - (a.chessRating || 0));
    }, [students]);

    const chessAttendanceToday = useMemo(() => {
        const todayStrInKST = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).split(' ')[0];
        const studentIds = new Set<string>();
        transactions.forEach(t => {
            if (t.type === 'chess_attendance' && 
                new Date(t.timestamp).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).startsWith(todayStrInKST) && 
                t.status === 'active') {
                studentIds.add(t.studentId);
            }
        });
        return studentIds;
    }, [transactions]);

    const sortedMatches = useMemo(() => {
        return [...matches].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [matches]);

    useEffect(() => {
        if (editingState) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [editingState?.studentId]);

    const getPlayerName = (id: string) => {
        if (id === NON_CHESS_PLAYER_ID) return nonChessPlayer.name;
        return students.find(s => s.id === id)?.name || '...';
    }

    const handleSelectPlayer = (student: Student, color: 'white' | 'black') => {
        if (color === 'white') {
            if (blackToRecord?.id === student.id) return;
            setWhiteToRecord(student);
        } else {
            if (whiteToRecord?.id === student.id) return;
            setBlackToRecord(student);
        }
    };
    
    const resetMatchSelection = () => {
        setWhiteToRecord(null);
        setBlackToRecord(null);
        setResult('white');
    };

    const handleRecord = () => {
        if (!whiteToRecord || !blackToRecord) return;
        onRecordMatch(whiteToRecord.id, blackToRecord.id, result);
        resetMatchSelection();
    };
    
    const handleCancelClick = (match: ChessMatch) => {
        setConfirmation({
            message: `${new Date(match.timestamp).toLocaleDateString('ko-KR')}의\n'${getPlayerName(match.whitePlayerId)} vs ${getPlayerName(match.blackPlayerId)}' 경기를 취소하시겠습니까?`,
            actions: [
                { text: '닫기', onClick: () => setConfirmation(null) },
                { text: '취소 실행', className: 'danger', onClick: () => {
                    onCancelMatch(match.id);
                    setConfirmation(null);
                }}
            ]
        });
    };

    const handleRatingClick = (student: Student) => {
        setEditingState({
            studentId: student.id,
            rating: String(Math.round(student.chessRating || 1000)),
        });
    };
    
    const handleRatingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (editingState) {
            setEditingState({ ...editingState, rating: e.target.value });
        }
    };

    const handleRatingUpdate = () => {
        if (editingState) {
            const newRating = parseInt(editingState.rating, 10) || 0;
            onUpdateChessRating(editingState.studentId, newRating);
            setEditingState(null);
        }
    };
    
    const handleRatingKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace') e.stopPropagation();
        if (e.key === 'Enter') handleRatingUpdate();
        else if (e.key === 'Escape') setEditingState(null);
    };

    const studentMissions = useMemo(() => {
        if (!missionStudent) return [];
    
        const attendanceMission: Mission = {
            id: 'chess_attendance_mission',
            description: '체스반 출석',
            stones: generalSettings.chessAttendanceValue,
            type: 'attendance',
        };
    
        return [attendanceMission, ...chessMissions];
    }, [missionStudent, chessMissions, generalSettings.chessAttendanceValue]);

    const missionCompletionCounts = useMemo(() => {
        if (!missionStudent) return new Map<string, number>();

        const todayStrInKST = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).split(' ')[0];
        const counts = new Map<string, number>();

        transactions
            .filter(t => t.studentId === missionStudent.id && new Date(t.timestamp).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).startsWith(todayStrInKST))
            .forEach(t => {
                if (t.type === 'mission' || t.type === 'chess_attendance') {
                    let desc = t.description;
                    if (desc.includes(' (부분 점수)')) {
                        desc = desc.replace(' (부분 점수)', '');
                    }
                    counts.set(desc, (counts.get(desc) || 0) + 1);
                }
            });
        return counts;
    }, [missionStudent, transactions]);

    const handleNonChessRatingUpdate = () => {
        const newRating = parseInt(nonChessRatingInput, 10);
        if (!isNaN(newRating) && newRating >= 0) {
            if (newRating !== generalSettings.nonChessPlayerRating) {
                onUpdateGeneralSettings({ ...generalSettings, nonChessPlayerRating: newRating });
            }
        } else {
            setNonChessRatingInput(String(Math.round(generalSettings.nonChessPlayerRating)));
        }
    };

    const handleOpenPartialMissionModal = (mission: Mission) => {
        setPartialMission(mission);
        setPartialAmount(String(mission.stones));
    };

    const handlePartialMissionSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!missionStudent || !partialMission) return;

        const amount = parseInt(partialAmount, 10);
        if (isNaN(amount) || amount <= 0 || amount > partialMission.stones) {
            alert(`1에서 ${partialMission.stones} 사이의 숫자를 입력해주세요.`);
            return;
        }

        onAddTransaction(missionStudent.id, 'mission', `${partialMission.description} (부분 점수)`, amount);
        
        setPartialMission(null);
        setPartialAmount('');
    };

    const handleOpenPenaltyModal = () => {
        if (!missionStudent) return;
        setPenaltyAmount('');
        setPenaltyReason('');
        setIsPenaltyModalOpen(true);
    };

    const handlePenaltySubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!missionStudent) return;
        
        const amount = parseInt(penaltyAmount, 10);
        if (isNaN(amount) || amount <= 0) {
            alert('유효한 감점 스톤을 입력해주세요.');
            return;
        }

        if (!penaltyReason.trim()) {
             alert('감점 사유를 입력해주세요.');
             return;
        }

        onAddTransaction(missionStudent.id, 'adjustment', penaltyReason, -amount);
        setIsPenaltyModalOpen(false);
        setPenaltyAmount('');
        setPenaltyReason('');
    };


    return (
        <div className="chess-panel-container">
            <div className="chess-roster-wrapper">
                <div className="view-header-actions">
                    <h3>체스반 명단</h3>
                    <button className="btn" onClick={() => setIsSettingsModalOpen(true)}>설정</button>
                </div>
                {/* FIX: Ensure direct class for scrolling control */}
                <div className="student-table" style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem', border: '1px solid #eee', borderRadius: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8f9fa' }}>
                            <tr>
                                <th>순위</th>
                                <th>이름</th>
                                <th>레이팅</th>
                                <th>판수</th>
                                <th>보유 스톤</th>
                                <th>작업</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="non-chess-player-row">
                                <td>-</td>
                                <td><strong>{nonChessPlayer.name}</strong></td>
                                <td className="rating-cell">
                                    <input 
                                        type="number" 
                                        value={nonChessRatingInput}
                                        onChange={e => setNonChessRatingInput(e.target.value)}
                                        onBlur={handleNonChessRatingUpdate}
                                        onKeyDown={e => {
                                            if (e.key === 'Backspace') e.stopPropagation();
                                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                            if (e.key === 'Escape') {
                                                setNonChessRatingInput(String(Math.round(generalSettings.nonChessPlayerRating)));
                                                (e.target as HTMLInputElement).blur();
                                            }
                                        }}
                                        style={{width: '60px', textAlign: 'center', fontWeight: 'bold'}}
                                    />
                                </td>
                                <td>-</td>
                                <td>-</td>
                                <td className="actions">
                                    <button className="btn-sm" onClick={() => handleSelectPlayer(nonChessPlayer, 'white')} disabled={whiteToRecord?.id === nonChessPlayer.id || blackToRecord?.id === nonChessPlayer.id}>백</button>
                                    <button className="btn-sm" onClick={() => handleSelectPlayer(nonChessPlayer, 'black')} disabled={blackToRecord?.id === nonChessPlayer.id || whiteToRecord?.id === nonChessPlayer.id}>흑</button>
                                </td>
                            </tr>
                            {chessStudents.map((student, index) => {
                                return (
                                    <tr key={student.id} onClick={() => setMissionStudent(student)} className={missionStudent?.id === student.id ? 'selected-for-mission' : ''}>
                                        <td data-label="순위">{index + 1}</td>
                                        <td data-label="이름">{student.name}</td>
                                        <td data-label="레이팅" className="rating-cell" onClick={(e) => {e.stopPropagation(); if(editingState?.studentId !== student.id) handleRatingClick(student)}}>
                                            {editingState?.studentId === student.id ? (
                                                <input ref={inputRef} type="number" value={editingState.rating} onChange={handleRatingChange} onBlur={handleRatingUpdate} onKeyDown={handleRatingKeyDown} onClick={(e) => e.stopPropagation()} />
                                            ) : (
                                                <strong>{Math.round(student.chessRating || 1000)}</strong>
                                            )}
                                        </td>
                                        <td data-label="판수">{student.chessGamesPlayed || 0}</td>
                                        <td data-label="보유 스톤">{student.stones} / {student.maxStones}</td>
                                        <td data-label="작업" className="actions">
                                            <button className="btn-sm" onClick={(e) => {e.stopPropagation(); handleSelectPlayer(student, 'white')}} disabled={whiteToRecord?.id === student.id || blackToRecord?.id === student.id}>백</button>
                                            <button className="btn-sm" onClick={(e) => {e.stopPropagation(); handleSelectPlayer(student, 'black')}} disabled={blackToRecord?.id === student.id || whiteToRecord?.id === student.id}>흑</button>
                                            <button className="btn-sm danger" onClick={(e) => {e.stopPropagation(); onChessAbsencePenalty(student.id)}}>결석</button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                
                <div className="new-match-recorder">
                     <h3>새 대국 기록</h3>
                     <div className="player-selection-display">
                        <div className={`player-slot ${whiteToRecord ? 'filled' : ''}`}>
                             {whiteToRecord ? whiteToRecord.name : '백(White) 선택'}
                             <span>{whiteToRecord ? `${Math.round(whiteToRecord.chessRating || 1000)}` : '-'}</span>
                        </div>
                         <span className="vs-text">VS</span>
                         <div className={`player-slot ${blackToRecord ? 'filled' : ''}`}>
                             {blackToRecord ? blackToRecord.name : '흑(Black) 선택'}
                             <span>{blackToRecord ? `${Math.round(blackToRecord.chessRating || 1000)}` : '-'}</span>
                        </div>
                    </div>
                     <div className="result-options">
                        <label><input type="radio" name="result" value="white" checked={result === 'white'} onChange={() => setResult('white')} /> 백 승</label>
                        <label><input type="radio" name="result" value="black" checked={result === 'black'} onChange={() => setResult('black')} /> 흑 승</label>
                        <label><input type="radio" name="result" value="draw" checked={result === 'draw'} onChange={() => setResult('draw')} /> 무승부</label>
                    </div>
                    <div style={{display: 'flex', gap: '1rem', justifyContent: 'center'}}>
                        <button onClick={resetMatchSelection} className="btn">초기화</button>
                        <button onClick={handleRecord} className="btn primary" disabled={!whiteToRecord || !blackToRecord}>결과 기록</button>
                    </div>
                </div>
            </div>
            
            <div className="chess-mission-panel">
                 <h3>체스 미션</h3>
                 {missionStudent ? (
                    <>
                        <p><strong>{missionStudent.name}</strong> 학생의 미션</p>
                        <ul className="mission-list">
                           {studentMissions.length > 0 ? studentMissions.map(mission => {
                                // FIX: Display completion count for attendance mission as well
                                const completionsToday = missionCompletionCounts.get(mission.description) || 0;

                                if (mission.id === 'chess_attendance_mission') {
                                    const hasAttended = chessAttendanceToday.has(missionStudent.id);
                                    return (
                                        <li key={mission.id} className="mission-item">
                                            <span>{mission.description}</span>
                                            <div className="mission-actions">
                                                {/* Added completion count display for attendance */}
                                                {completionsToday > 0 && (
                                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-color-secondary)' }}>
                                                        ({completionsToday}회)
                                                    </span>
                                                )}
                                                <span className="mission-stones">+{mission.stones}</span>
                                                <button className="btn-sm primary" onClick={() => onChessAttendance(missionStudent.id)} disabled={hasAttended}>
                                                    {hasAttended ? '완료' : '출석'}
                                                </button>
                                            </div>
                                        </li>
                                    );
                                }

                                return (
                                    <li key={mission.id} className="mission-item">
                                        <span>{mission.description}</span>
                                        <div className="mission-actions">
                                            {completionsToday > 0 && (
                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-color-secondary)' }}>
                                                    ({completionsToday}회)
                                                </span>
                                            )}
                                            <span className="mission-stones">+{mission.stones}</span>
                                            <button className="btn-sm" onClick={() => handleOpenPartialMissionModal(mission)} disabled={missionStudent.stones >= missionStudent.maxStones}>부분</button>
                                            <button className="btn-sm primary" onClick={() => onAddTransaction(missionStudent.id, 'mission', mission.description, mission.stones)} disabled={missionStudent.stones >= missionStudent.maxStones}>완료</button>
                                        </div>
                                    </li>
                                )
                           }) : <p>체스반 미션이 없습니다.</p>}
                        </ul>
                        <div style={{ marginTop: '1rem', textAlign: 'right' }}>
                             <button className="btn danger" onClick={handleOpenPenaltyModal}>감점 (패널티)</button>
                        </div>
                    </>
                 ) : (
                    <p style={{textAlign: 'center', color: 'var(--text-color-secondary)', marginTop: '2rem'}}>명단에서 학생을 선택하여 미션을 확인하세요.</p>
                 )}
            </div>

            <div className="chess-history-panel">
                <div className="match-history" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <h4 style={{ marginBottom: '1rem' }}>최근 대결 기록</h4>
                    <div className="student-table" style={{ flex: 1, overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    <th style={{ padding: '0.8rem' }}>날짜</th>
                                    <th style={{ padding: '0.8rem' }}>대결 (백 vs 흑)</th>
                                    <th style={{ padding: '0.8rem' }}>결과</th>
                                    <th style={{ padding: '0.8rem' }}>변동</th>
                                    <th style={{ padding: '0.8rem' }}>작업</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedMatches.slice(0, 20).map(match => {
                                    const isCancelled = match.status === 'cancelled';
                                    return (
                                        <tr key={match.id} style={{ 
                                            opacity: isCancelled ? 0.5 : 1, 
                                            backgroundColor: isCancelled ? '#fafafa' : 'white',
                                            textDecoration: isCancelled ? 'line-through' : 'none'
                                        }}>
                                            <td style={{ padding: '0.8rem', fontSize: '0.85rem' }}>
                                                {new Date(match.timestamp).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                                            </td>
                                            <td style={{ padding: '0.8rem' }}>
                                                <span style={{ fontWeight: 600 }}>{getPlayerName(match.whitePlayerId)}</span> 
                                                <small style={{ color: '#888', margin: '0 4px' }}>vs</small> 
                                                <span style={{ fontWeight: 600 }}>{getPlayerName(match.blackPlayerId)}</span>
                                            </td>
                                            <td style={{ padding: '0.8rem' }}>
                                                <span className={match.result === 'draw' ? '' : 'winner-label'} style={{ 
                                                    backgroundColor: match.result === 'draw' ? '#eee' : (match.result === 'white' ? 'var(--primary-color)' : 'var(--danger-color)'),
                                                    color: match.result === 'draw' ? '#666' : 'white',
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 'bold',
                                                    marginLeft: 0
                                                }}>
                                                    {match.result === 'draw' ? '무승부' : (match.result === 'white' ? '백 승' : '흑 승')}
                                                </span>
                                            </td>
                                            <td style={{ padding: '0.8rem', fontWeight: 'bold' }}>
                                                {!isCancelled ? (
                                                    <span style={{ color: match.ratingDeltaForWhite >= 0 ? 'var(--primary-color)' : 'var(--danger-color)' }}>
                                                        {match.ratingDeltaForWhite >= 0 ? '+' : ''}{match.ratingDeltaForWhite}
                                                    </span>
                                                ) : '-'}
                                            </td>
                                            <td style={{ padding: '0.8rem' }}>
                                                <button 
                                                    className="btn-sm danger" 
                                                    onClick={() => handleCancelClick(match)} 
                                                    disabled={isCancelled}
                                                    style={{ padding: '2px 8px', fontSize: '0.7rem' }}
                                                >
                                                    취소
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {sortedMatches.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>대국 기록이 없습니다.</div>
                        )}
                    </div>
                </div>
            </div>

            {isSettingsModalOpen && <ChessSettingsModal
                isOpen={isSettingsModalOpen}
                onClose={() => setIsSettingsModalOpen(false)}
                settings={generalSettings}
                onUpdateSettings={onUpdateGeneralSettings}
            />}
            {confirmation && <ConfirmationModal {...confirmation} onClose={() => setConfirmation(null)} />}
            
             {/* Partial Mission Modal */}
             {partialMission && (
                <div className="modal-overlay" onClick={() => setPartialMission(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2>부분 점수 지급</h2>
                        <form onSubmit={handlePartialMissionSubmit}>
                            <div className="form-group">
                                <label>미션</label>
                                <p style={{ fontWeight: '500', padding: '0.5rem', background: 'var(--bg-color)', borderRadius: '4px' }}>{partialMission.description}</p>
                            </div>
                            <div className="form-group">
                                <label htmlFor="partial-amount">지급할 스톤 (최대 {partialMission.stones})</label>
                                <input
                                    type="number"
                                    id="partial-amount"
                                    value={partialAmount}
                                    onChange={(e) => setPartialAmount(e.target.value)}
                                    min="1"
                                    max={partialMission.stones}
                                    required
                                    autoFocus
                                    placeholder="점수 입력"
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn" onClick={() => setPartialMission(null)}>취소</button>
                                <button type="submit" className="btn primary">지급</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            
            {/* Penalty Modal */}
             {isPenaltyModalOpen && (
                <div className="modal-overlay" onClick={() => setIsPenaltyModalOpen(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2>감점 (패널티) 적용</h2>
                        <form onSubmit={handlePenaltySubmit}>
                            <div className="form-group">
                                <label htmlFor="penalty-amount">차감할 스톤</label>
                                <input
                                    type="number"
                                    id="penalty-amount"
                                    value={penaltyAmount}
                                    onChange={(e) => setPenaltyAmount(e.target.value)}
                                    min="1"
                                    required
                                    autoFocus
                                    placeholder="예: 5"
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="penalty-reason">사유</label>
                                <input
                                    type="text"
                                    id="penalty-reason"
                                    value={penaltyReason}
                                    onChange={(e) => setPenaltyReason(e.target.value)}
                                    required
                                    placeholder="예: 수업 태도 불량"
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn" onClick={() => setIsPenaltyModalOpen(false)}>취소</button>
                                <button type="submit" className="btn danger">차감 적용</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
