
import React, { useState, useEffect, useRef } from 'react';
import type { Student, TournamentData, TournamentSettings, MissionBadukPlayer, MissionBadukActiveMission, MissionBadukData } from '../../types';
import { ConfirmationModal } from '../modals/ConfirmationModal';

interface TournamentMissionViewProps {
    students: Student[];
    data: TournamentData;
    setData: React.Dispatch<React.SetStateAction<TournamentData>>;
    settings: TournamentSettings;
    onBulkAddTransaction: (studentIds: string[], description: string, amount: number) => void;
    onOpenPlayerManagement: () => void;
}

// Helper to calculate remaining time
const calculateTimeLeft = (player: MissionBadukPlayer, timeLimitMinutes: number) => {
    if (!player.startTime || player.status === 'finished') return 0;
    
    const limitMs = (timeLimitMinutes + (player.timeAdded || 0)) * 60 * 1000;
    const elapsed = Date.now() - new Date(player.startTime).getTime();
    const remaining = Math.ceil((limitMs - elapsed) / 1000);
    
    return Math.max(-3599, remaining); // Allow negative time for display if needed, but floor at -1hr
};

const formatTime = (seconds: number) => {
    const absSec = Math.abs(seconds);
    const m = Math.floor(absSec / 60);
    const s = absSec % 60;
    const prefix = seconds < 0 ? "-" : "";
    return `${prefix}${m}:${s.toString().padStart(2, '0')}`;
};

// Slot Machine Component for Text
const TextSlotMachine = ({ text, isSpinning, stars }: { text: string, isSpinning: boolean, stars?: number }) => {
    const [displayText, setDisplayText] = useState(text);
    const chars = "가나다라마바사아자차카타파하ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    useEffect(() => {
        let interval: any;
        if (isSpinning) {
            interval = setInterval(() => {
                let randomText = "";
                for(let i=0; i < Math.min(10, text.length || 10); i++) {
                    randomText += chars[Math.floor(Math.random() * chars.length)];
                }
                setDisplayText(randomText);
            }, 50);
        } else {
            setDisplayText(text);
        }
        return () => clearInterval(interval);
    }, [isSpinning, text]);

    return (
        <div className="mission-text-line">
            <span className="mission-stars-fixed" aria-hidden="true">
                {!isSpinning && stars ? '★'.repeat(stars) : '\u00A0'}
            </span>
            <span className={`mission-text ${isSpinning ? 'spinning' : ''}`}>{displayText}</span>
        </div>
    );
};

interface MissionPlayerRowProps {
    player: MissionBadukPlayer;
    settings: TournamentSettings;
    onUpdate: (id: string, updates: Partial<MissionBadukPlayer>) => void;
    onFinish: (id: string) => void;
    onRemove: (id: string) => void;
}

const MissionPlayerRow: React.FC<MissionPlayerRowProps> = ({ 
    player, 
    settings, 
    onUpdate, 
    onFinish,
    onRemove
}) => {
    const [timeLeft, setTimeLeft] = useState(0);
    const [spinningType, setSpinningType] = useState<'match' | 'wearable' | 'all' | null>(null);
    const missionSettings = settings.missionBaduk;

    useEffect(() => {
        if (player.status === 'active' && player.startTime) {
            const updateTimer = () => {
                const remaining = calculateTimeLeft(player, missionSettings?.timeLimit || 50);
                setTimeLeft(remaining);
                // Removed auto-finish logic: No longer automatically calling onFinish(player.studentId)
            };
            
            updateTimer();
            const interval = setInterval(updateTimer, 1000);
            return () => clearInterval(interval);
        } else {
            setTimeLeft(0);
        }
    }, [player.status, player.startTime, player.timeAdded, missionSettings?.timeLimit, player.studentId]);

    const handleStart = () => {
        onUpdate(player.studentId, { status: 'active', startTime: new Date().toISOString() });
        handleGenerateMission('all');
    };

    const handleAddTime = () => {
        onUpdate(player.studentId, { timeAdded: (player.timeAdded || 0) + 10 });
    };

    const handleGenerateMission = (type: 'match' | 'wearable' | 'all') => {
        if (!missionSettings) return;
        setSpinningType(type);

        setTimeout(() => {
            const currentMission = { ...(player.currentMission || { matchMission: '', wearableMission: '', matchMissionStars: 0, wearableMissionStars: 0, matchMissionPoints: 0 }) };
            const pts = missionSettings.points || { star1: 1, star2: 2, star3: 3, star4: 4, star5: 5 };
            
            if (type === 'match' || type === 'all') {
                const defs = missionSettings.matchMissions;
                if (defs && defs.length > 0) {
                    const randomDef = defs[Math.floor(Math.random() * defs.length)];
                    const n = Math.floor(Math.random() * (randomDef.max - randomDef.min + 1)) + randomDef.min;
                    currentMission.matchMission = randomDef.template.replace('{n}', n.toString());
                    
                    let stars = randomDef.defaultStars || 3;
                    currentMission.matchMissionStars = stars;
                    currentMission.matchMissionDefId = randomDef.id;
                    currentMission.matchMissionPoints = (pts as any)[`star${stars}`] || stars;
                }
            }

            if (type === 'wearable' || type === 'all') {
                const wMissions = missionSettings.wearableMissions;
                if (wMissions && wMissions.length > 0) {
                    const randomMission = wMissions[Math.floor(Math.random() * wMissions.length)];
                    if (typeof randomMission === 'string') {
                        currentMission.wearableMission = randomMission;
                        currentMission.wearableMissionStars = 0; 
                    } else {
                        currentMission.wearableMission = randomMission.text;
                        currentMission.wearableMissionStars = randomMission.stars;
                    }
                }
            }

            onUpdate(player.studentId, { currentMission });
            setSpinningType(null);
        }, 600);
    };

    const handleMissionSuccess = (type: 'match' | 'wearable') => {
        let points = 0;
        const pts = missionSettings?.points || { star1: 1, star2: 2, star3: 3, star4: 4, star5: 5, wearableMissionSuccess: 1 };

        if (type === 'match') {
            points = player.currentMission?.matchMissionPoints || 0;
        } else {
            const stars = player.currentMission?.wearableMissionStars;
            if (stars && stars > 0) {
                points = (pts as any)[`star${stars}`] || stars;
            } else {
                points = pts.wearableMissionSuccess || 1;
            }
        }
        
        onUpdate(player.studentId, { score: player.score + points });
    };

    const handleQuickAction = (action: string) => {
        let points = 0;
        const pts = missionSettings?.points as any || {};
        
        if (action === 'win19') points = pts.win19 || 3;
        if (action === 'win13') points = pts.win13 || 2;
        if (action === 'win9') points = pts.win9 || 1;
        if (action === 'penalty') points = -(pts.penaltyDeduction || 1);
        
        onUpdate(player.studentId, { score: Math.max(0, (player.score || 0) + points) });
    };

    const handleManualScore = () => {
        const input = prompt("조절할 점수를 입력하세요 (예: 5 또는 -5)", "0");
        if (input) {
            const points = parseInt(input, 10);
            if (!isNaN(points)) {
                onUpdate(player.studentId, { score: Math.max(0, (player.score || 0) + points) });
            }
        }
    };

    return (
        <div className={`mission-row-card ${player.status === 'finished' ? 'status-finished' : 'status-active'}`}>
            <div className="mission-row-main">
                {/* 좌측: 이름, 점수, 타이머, +10분, 종료 */}
                <div className="mission-card-left">
                    <button className="row-delete-btn" onClick={(e) => { e.stopPropagation(); onRemove(player.studentId); }} title="명단에서 제거">×</button>
                    <div className="mission-left-info">
                        <div className="mission-row-name">{player.name}</div>
                        <div className="mission-row-score">{player.score}점</div>
                    </div>
                    <div className="mission-row-status-btns">
                        {player.status === 'waiting' && (
                            <button type="button" className="btn-xs primary" onClick={handleStart}>시작</button>
                        )}
                        {player.status === 'active' && (
                            <div className="mission-time-btns">
                                <span className={`mission-row-timer ${timeLeft <= 0 ? 'status-expired' : ''}`}>{formatTime(timeLeft)}</span>
                                <button type="button" className="btn-xs" onClick={handleAddTime}>+10분</button>
                                <button type="button" className="btn-xs danger" onClick={() => onFinish(player.studentId)}>종료</button>
                            </div>
                        )}
                    </div>
                </div>

                {/* 중앙: 미션1, 미션2 */}
                <div className="mission-card-center">
                    <div className="mission-mini-card match">
                        <div className="mission-mini-label">{missionSettings?.matchMissionLabel || '미션1'}</div>
                        <TextSlotMachine 
                            text={player.currentMission?.matchMission || '미션 없음'} 
                            isSpinning={spinningType === 'match' || spinningType === 'all'}
                            stars={player.currentMission?.matchMissionStars}
                        />
                        <div className="mission-card-actions">
                            <button type="button" className="btn-xs success" onClick={() => handleMissionSuccess('match')} disabled={player.status !== 'active'}>성공</button>
                            <button type="button" className="btn-xs" onClick={() => handleGenerateMission('match')} disabled={player.status !== 'active'}>변경</button>
                        </div>
                    </div>
                    <div className="mission-mini-card wearable">
                        <div className="mission-mini-label">{missionSettings?.wearableMissionLabel || '미션2'}</div>
                        <TextSlotMachine 
                            text={player.currentMission?.wearableMission || '미션 없음'} 
                            isSpinning={spinningType === 'wearable' || spinningType === 'all'}
                            stars={player.currentMission?.wearableMissionStars}
                        />
                        <div className="mission-card-actions">
                            <button type="button" className="btn-xs success" onClick={() => handleMissionSuccess('wearable')} disabled={player.status !== 'active'}>성공</button>
                            <button type="button" className="btn-xs" onClick={() => handleGenerateMission('wearable')} disabled={player.status !== 'active'}>변경</button>
                        </div>
                    </div>
                </div>

                {/* 우측: 19줄, 13줄, 9줄, 감점, 조절 */}
                <div className="mission-card-right">
                    <div className="quick-action-grid">
                        <button type="button" className="btn-xs" onClick={() => handleQuickAction('win19')} disabled={player.status !== 'active'}>19줄</button>
                        <button type="button" className="btn-xs" onClick={() => handleQuickAction('win13')} disabled={player.status !== 'active'}>13줄</button>
                        <button type="button" className="btn-xs" onClick={() => handleQuickAction('win9')} disabled={player.status !== 'active'}>9줄</button>
                        <button type="button" className="btn-xs danger" onClick={() => handleQuickAction('penalty')} disabled={player.status !== 'active'}>감점</button>
                        <button type="button" className="btn-xs" onClick={handleManualScore} disabled={player.status !== 'active'}>조절</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

interface MissionFinishModalProps {
    player: MissionBadukPlayer;
    settings: TournamentSettings;
    onClose: () => void;
    onConfirm: (stones: number) => void;
}

const MissionFinishModal = ({ player, settings, onClose, onConfirm }: MissionFinishModalProps) => {
    const ratio = settings.missionBaduk?.scoreToStoneRatio || 1;
    const baseStones = player.score * ratio;
    const [bonusStones, setBonusStones] = useState(0);
    const [isRolling, setIsRolling] = useState(false);
    const [rolledTier, setRolledTier] = useState<string | null>(null);
    const [step, setStep] = useState<'base' | 'bonus' | 'result'>('base');

    const handleRollBonus = () => {
        setIsRolling(true);
        setStep('bonus');
        
        const tiers = settings.missionBaduk?.bonusTiers || [];
        if (tiers.length === 0) {
            setBonusStones(0);
            setRolledTier("보너스 없음");
            setIsRolling(false);
            setStep('result');
            return;
        }

        let totalWeight = 0;
        tiers.forEach(t => totalWeight += t.rate);
        
        setTimeout(() => {
            const random = Math.random() * totalWeight;
            let currentWeight = 0;
            let result = tiers[tiers.length - 1];

            for (const tier of tiers) {
                currentWeight += tier.rate;
                if (random <= currentWeight) {
                    result = tier;
                    break;
                }
            }

            setRolledTier(result.label);
            setBonusStones(result.reward);
            setIsRolling(false);
            setStep('result');
        }, 2000);
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content finish-modal-content" onClick={e => e.stopPropagation()}>
                <h2>{player.name} 미션 종료</h2>
                
                <div className="finish-score-display">
                    획득 점수: {player.score}점
                </div>
                
                {step === 'base' && (
                    <div>
                        <p>기본 보상: {baseStones} 스톤</p>
                        {player.score > 0 ? (
                            <button className="btn primary" onClick={handleRollBonus}>보너스 뽑기 도전!</button>
                        ) : (
                            <div style={{marginTop: '1.5rem'}}>
                                <p style={{color: '#888', marginBottom: '1.5rem'}}>획득 점수가 0점이라 보너스 기회가 없습니다.</p>
                                <button className="btn primary" onClick={() => onConfirm(0)}>종료하기</button>
                            </div>
                        )}
                        <div style={{marginTop: '1rem'}}>
                            <button className="btn" onClick={onClose}>취소</button>
                        </div>
                    </div>
                )}

                {(step === 'bonus' || step === 'result') && (
                    <div className="bonus-section">
                        <div className={`bonus-slot-machine ${isRolling ? 'shaking' : ''}`}>
                            <div className="bonus-slot-window">
                                {isRolling ? (
                                    <span className="slot-text spinning">???</span>
                                ) : (
                                    <span className="slot-text result">{rolledTier}</span>
                                )}
                            </div>
                        </div>
                        {!isRolling && step === 'result' && (
                            <div className="bonus-result-info">
                                보너스: +{bonusStones} 스톤
                            </div>
                        )}
                    </div>
                )}

                {step === 'result' && (
                    <div className="total-reward-display">
                        <p>최종 보상</p>
                        <span className="total-reward-amount">{baseStones + bonusStones}</span>
                        <div className="modal-actions" style={{justifyContent: 'center'}}>
                            <button className="btn primary" onClick={() => onConfirm(baseStones + bonusStones)}>스톤 지급 및 종료</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export const TournamentMissionView = (props: TournamentMissionViewProps) => {
    const { students, data, setData, settings, onBulkAddTransaction, onOpenPlayerManagement } = props;
    
    const [history, setHistory] = useState<MissionBadukData[]>([]);
    const [finishingPlayerId, setFinishingPlayerId] = useState<string | null>(null);

    const saveHistory = () => {
        if (data.missionBaduk) {
            setHistory(prev => [...prev.slice(-9), JSON.parse(JSON.stringify(data.missionBaduk))]);
        }
    };

    const handleUndo = () => {
        if (history.length === 0) return;
        const previousState = history[history.length - 1];
        setHistory(prev => prev.slice(0, -1));
        setData(prev => ({ ...prev, missionBaduk: previousState }));
    };

    const handlePlayerUpdate = (studentId: string, updates: Partial<MissionBadukPlayer>) => {
        saveHistory();
        setData(prev => {
            if (!prev.missionBaduk) return prev;
            const newPlayers = prev.missionBaduk.players.map(p => 
                p.studentId === studentId ? { ...p, ...updates } : p
            );
            return { ...prev, missionBaduk: { ...prev.missionBaduk, players: newPlayers } };
        });
    };

    const handleRemovePlayer = (studentId: string) => {
        // 즉시 삭제 처리 (사용자 경험 개선)
        saveHistory();
        setData(prev => {
            if (!prev.missionBaduk) return prev;
            // 1. MissionBaduk 리스트에서 완전 삭제
            const newPlayers = prev.missionBaduk.players.filter(p => p.studentId !== studentId);
            // 2. TournamentData의 미션 참가자 명단에서도 삭제
            const newParticipantIds = (prev.missionParticipantIds || []).filter(id => id !== studentId);
            
            return { 
                ...prev, 
                missionParticipantIds: newParticipantIds,
                missionBaduk: { ...prev.missionBaduk, players: newPlayers } 
            };
        });
    };

    const handleFinishConfirm = (stones: number) => {
        if (finishingPlayerId) {
            // 1. 스톤 지급
            if (stones > 0) {
                onBulkAddTransaction([finishingPlayerId], '미션 바둑 최종 보상', stones);
            }
            
            // 2. 즉시 리스트에서 제거 (완료 학생 제거와 동일한 효과)
            saveHistory();
            setData(prev => {
                if (!prev.missionBaduk) return prev;
                // 선수 리스트에서 필터링
                const newPlayers = prev.missionBaduk.players.filter(p => p.studentId !== finishingPlayerId);
                // 참가자 명단에서도 삭제
                const newParticipantIds = (prev.missionParticipantIds || []).filter(id => id !== finishingPlayerId);

                return {
                    ...prev,
                    missionParticipantIds: newParticipantIds,
                    missionBaduk: { ...prev.missionBaduk, players: newPlayers }
                };
            });
            
            setFinishingPlayerId(null);
        }
    };

    const handleClearFinished = () => {
        saveHistory();
        setData(prev => {
            if (!prev.missionBaduk) return prev;
            const finishedIds = prev.missionBaduk.players
                .filter(p => p.status === 'finished')
                .map(p => p.studentId);
                
            const activePlayers = prev.missionBaduk.players.filter(p => p.status !== 'finished');
            const newParticipantIds = (prev.missionParticipantIds || []).filter(id => !finishedIds.includes(id));
            
            return { 
                ...prev, 
                missionParticipantIds: newParticipantIds,
                missionBaduk: { ...prev.missionBaduk, players: activePlayers } 
            };
        });
    };

    const sortedPlayers = [...(data.missionBaduk?.players || [])].sort((a, b) => {
        return a.name.localeCompare(b.name);
    });

    if (!data.missionBaduk || data.missionBaduk.players.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
                <p>참가자가 없습니다. 선수 관리에서 참가자를 추가해주세요.</p>
                <button className="btn" onClick={onOpenPlayerManagement}>선수 관리</button>
            </div>
        );
    }

    const finishingPlayer = data.missionBaduk.players.find(p => p.studentId === finishingPlayerId);

    return (
        <div className="mission-baduk-view">
            <div className="view-header-actions">
                <button className="btn" onClick={onOpenPlayerManagement}>선수 관리</button>
                <button className="btn" onClick={handleUndo} disabled={history.length === 0}>되돌리기</button>
                <button className="btn danger" onClick={handleClearFinished}>완료 학생 제거</button>
            </div>

            <div className="mission-integrated-view">
                {sortedPlayers.map(player => (
                    <MissionPlayerRow 
                        key={player.studentId} 
                        player={player} 
                        settings={settings} 
                        onUpdate={handlePlayerUpdate}
                        onFinish={setFinishingPlayerId}
                        onRemove={handleRemovePlayer}
                    />
                ))}
            </div>

            {finishingPlayer && (
                <MissionFinishModal 
                    player={finishingPlayer} 
                    settings={settings} 
                    onClose={() => setFinishingPlayerId(null)} 
                    onConfirm={handleFinishConfirm} 
                />
            )}
        </div>
    );
};
