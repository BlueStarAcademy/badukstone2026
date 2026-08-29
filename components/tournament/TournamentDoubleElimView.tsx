
import React, { useCallback, useState } from 'react';
import type { Student, TournamentAwardRequest, TournamentData, TournamentSettings, DoubleElimData, DoubleElimMatch } from '../../types';
import { generateId, parseRank } from '../../utils';
import {
    buildDoubleElim,
    applyByeWinners,
    propagateAllWinners,
    getLoserFromMatch,
} from '../../utils/doubleElimBracket';
import { DEFAULT_BYE_PRIORITY } from '../../utils/byePlacement';
import { getDoubleElimPlacements, buildBracketStyleGrants, getBracketPaidRankCount, type BracketPrizePayout } from '../../utils/tournamentPrizes';
import { DoubleElimBracketTree } from './DoubleElimBracketTree';
import { DoubleElimResultPanel } from './DoubleElimResultPanel';
import { TournamentPrizeModal } from './TournamentPrizeModal';
import { ConfirmationModal } from '../modals/ConfirmationModal';
import { StartRoundSelect } from './StartRoundSelect';

interface TournamentDoubleElimViewProps {
    data: TournamentData;
    students: Student[];
    setData: React.Dispatch<React.SetStateAction<TournamentData>>;
    settings: TournamentSettings;
    onOpenPlayerManagement: () => void;
    onAwardBatch: (request: TournamentAwardRequest) => boolean;
    awardEventKey: string;
}

export const TournamentDoubleElimView = (props: TournamentDoubleElimViewProps) => {
    const { data, students, setData, settings, onOpenPlayerManagement, onAwardBatch, awardEventKey } = props;
    const doubleElim = data.doubleElim;
    const participantIds = data.doubleElimParticipantIds || [];
    const [isPrizeModalOpen, setIsPrizeModalOpen] = useState(false);
    const [resetConfirmationOpen, setResetConfirmationOpen] = useState(false);
    const [assignmentMode, setAssignmentMode] = useState<'random' | 'ranked'>('ranked');
    const [startRoundSize, setStartRoundSize] = useState<number | null>(null);
    const handleStartRoundChange = useCallback((size: number | null) => setStartRoundSize(size), []);

    const getPlayerName = (id: string | 'BYE' | null) => {
        if (!id || id === 'BYE') return id === 'BYE' ? '부전승' : '—';
        return students.find(s => s.id === id)?.name ?? '?';
    };

    const handleStart = () => {
        const ids = participantIds.filter(id => students.some(s => s.id === id));
        if (ids.length < 2) {
            alert('더블엘리미네이션을 시작하려면 최소 2명이 필요합니다.');
            return;
        }
        const sorted =
            assignmentMode === 'ranked'
                ? [...ids].sort((a, b) => {
                    const ra = students.find(s => s.id === a);
                    const rb = students.find(s => s.id === b);
                    return parseRank(rb?.rank || '') - parseRank(ra?.rank || '');
                })
                : [...ids].sort(() => 0.5 - Math.random());
        const prio = settings.byePriority ?? DEFAULT_BYE_PRIORITY;
        setData(prev => ({
            ...prev,
            doubleElimParticipantIds: sorted,
            doubleElim: buildDoubleElim(sorted, prio, startRoundSize),
            awardSessionIds: { ...prev.awardSessionIds, doubleelim: generateId() },
        }));
    };

    const setMatchWinner = (bracket: 'winners' | 'losers' | 'grand', roundIndex: number, matchIndex: number, winnerId: string | null) => {
        setData(prev => {
            if (!prev.doubleElim) return prev;
            const next = JSON.parse(JSON.stringify(prev.doubleElim)) as DoubleElimData;
            const W = next.winnersRounds;
            const L = next.losersRounds;
            const GF = next.grandFinal!;

            if (bracket === 'grand') {
                GF.winnerId = winnerId;
                applyByeWinners(next);
                propagateAllWinners(next);
                return { ...prev, doubleElim: next };
            }

            if (bracket === 'winners') {
                const match = W[roundIndex].matches[matchIndex];
                match.winnerId = winnerId;
                applyByeWinners(next);
                propagateAllWinners(next);
                return { ...prev, doubleElim: next };
            }

            if (bracket === 'losers') {
                const match = L[roundIndex].matches[matchIndex];
                match.winnerId = winnerId;
                applyByeWinners(next);
                propagateAllWinners(next);
                return { ...prev, doubleElim: next };
            }

            return prev;
        });
    };

    const handleReset = () => {
        setData(prev => ({ ...prev, doubleElim: undefined, doubleElimParticipantIds: [] }));
        setResetConfirmationOpen(false);
    };

    const handleAwardPrizes = (prizes: BracketPrizePayout) => {
        if (!doubleElim) return;
        const { placementIds } = getDoubleElimPlacements(doubleElim);
        const grants = buildBracketStyleGrants(
            placementIds,
            prizes,
            getBracketPaidRankCount(settings),
            '더블엘리미네이션'
        );
        if (onAwardBatch({
            eventKey: awardEventKey,
            mode: 'doubleelim',
            label: '더블엘리미네이션 결과',
            grants,
            metadata: { phase: 'final' },
        })) setIsPrizeModalOpen(false);
    };

    const isFinished = !!doubleElim?.grandFinal?.winnerId;
    const [bracketTab, setBracketTab] = useState<'winners' | 'losers'>('winners');

    if (!doubleElim || doubleElim.playerIds.length === 0) {
        return (
            <div className="tournament-doubleelim-view">
                <div className="bracket-controls">
                    <button className="btn" onClick={onOpenPlayerManagement}>선수 관리</button>
                </div>
                <div className="bracket-view-body">
                    <div className="bracket-main">
                        <div className="bracket-wrapper tournament-empty-state">
                            <span className="tournament-empty-kicker">DOUBLE ELIMINATION SETUP</span>
                            <h3>더블엘리미네이션 준비</h3>
                            <p>더블엘리미네이션 대진이 없습니다. 선수 관리에서 참가자를 선택한 뒤 시작하세요.</p>
                            <div className="tournament-empty-setup">
                                <div className="tournament-player-mgmt-assign">
                                    <label htmlFor="doubleelim-empty-assign">배정/시드</label>
                                    <select
                                        id="doubleelim-empty-assign"
                                        value={assignmentMode}
                                        onChange={e => setAssignmentMode(e.target.value as 'random' | 'ranked')}
                                    >
                                        <option value="ranked">급수 순</option>
                                        <option value="random">무작위</option>
                                    </select>
                                </div>
                                <StartRoundSelect
                                    id="doubleelim-empty-start-round"
                                    playerCount={participantIds.length}
                                    value={startRoundSize}
                                    onChange={handleStartRoundChange}
                                    disabled={participantIds.length < 2}
                                />
                            </div>
                            <button className="btn primary" onClick={handleStart} disabled={participantIds.length < 2}>
                                더블엘리미네이션 시작
                            </button>
                        </div>
                    </div>
                    <DoubleElimResultPanel doubleElim={null} students={students} isFinished={false} onOpenPrizeModal={undefined} />
                </div>
            </div>
        );
    }

    return (
        <div className="tournament-doubleelim-view">
            <div className="bracket-controls">
                <button className="btn" onClick={onOpenPlayerManagement}>선수 관리</button>
                <button className="btn danger" onClick={() => setResetConfirmationOpen(true)}>초기화</button>
            </div>
            <div className="bracket-view-body">
                <div className="bracket-main">
                    <div className="bracket-wrapper doubleelim-bracket-wrapper">
                        <div className="doubleelim-tabs">
                            <button
                                type="button"
                                className={`tab-btn ${bracketTab === 'winners' ? 'active' : ''}`}
                                onClick={() => setBracketTab('winners')}
                            >
                                승자조
                            </button>
                            <button
                                type="button"
                                className={`tab-btn ${bracketTab === 'losers' ? 'active' : ''}`}
                                onClick={() => setBracketTab('losers')}
                            >
                                패자조
                            </button>
                        </div>
                        <div className="doubleelim-tab-content">
                            {bracketTab === 'winners' && (
                                <section className="doubleelim-section">
                                    <DoubleElimBracketTree
                                        rounds={doubleElim.winnersRounds}
                                        getPlayerName={getPlayerName}
                                        onSetWinner={(ri, mi, winnerId) => setMatchWinner('winners', ri, mi, winnerId)}
                                        keyPrefix="w"
                                    />
                                </section>
                            )}
                            {bracketTab === 'losers' && (
                                <section className="doubleelim-section">
                                    <DoubleElimBracketTree
                                        rounds={doubleElim.losersRounds}
                                        getPlayerName={getPlayerName}
                                        onSetWinner={(ri, mi, winnerId) => setMatchWinner('losers', ri, mi, winnerId)}
                                        keyPrefix="l"
                                    />
                                </section>
                            )}
                            {doubleElim.grandFinal && (
                                <section className="doubleelim-section doubleelim-grandfinal-section">
                                    <DoubleElimBracketTree
                                        rounds={[{ title: '그랜드 파이널', matches: [doubleElim.grandFinal] }]}
                                        getPlayerName={getPlayerName}
                                        onSetWinner={(_, __, winnerId) => setMatchWinner('grand', 0, 0, winnerId)}
                                        keyPrefix="g"
                                    />
                                </section>
                            )}
                        </div>
                    </div>
                </div>
                <DoubleElimResultPanel
                    doubleElim={doubleElim}
                    students={students}
                    isFinished={isFinished}
                    onOpenPrizeModal={isFinished ? () => setIsPrizeModalOpen(true) : undefined}
                />
            </div>
            {isPrizeModalOpen && (
                <TournamentPrizeModal
                    isOpen={isPrizeModalOpen}
                    onClose={() => setIsPrizeModalOpen(false)}
                    settings={settings}
                    prizeKey="bracket"
                    mode="doubleelim"
                    onAwardPrizes={handleAwardPrizes}
                />
            )}
            {resetConfirmationOpen && (
                <ConfirmationModal
                    message="더블엘리미네이션을 초기화하시겠습니까? 모든 경기 결과가 사라집니다."
                    onClose={() => setResetConfirmationOpen(false)}
                    actions={[
                        { text: '취소', onClick: () => setResetConfirmationOpen(false) },
                        { text: '초기화', className: 'danger', onClick: handleReset },
                    ]}
                />
            )}
        </div>
    );
};
