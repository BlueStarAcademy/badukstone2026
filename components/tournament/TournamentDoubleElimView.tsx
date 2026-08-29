
import React, { useState } from 'react';
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
        const sorted = [...ids].sort((a, b) => {
            const ra = students.find(s => s.id === a);
            const rb = students.find(s => s.id === b);
            return parseRank(rb?.rank || '') - parseRank(ra?.rank || '');
        });
        const prio = settings.byePriority ?? DEFAULT_BYE_PRIORITY;
        setData(prev => ({
            ...prev,
            doubleElimParticipantIds: sorted,
            doubleElim: buildDoubleElim(sorted, prio),
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
                const prevWinner = match.winnerId;
                match.winnerId = winnerId;
                const loserId = winnerId ? getLoserFromMatch(match, winnerId) : null;

                const nextRoundIndex = roundIndex + 1;
                const nextMatchInW = nextRoundIndex < W.length ? W[nextRoundIndex].matches[Math.floor(matchIndex / 2)] : null;
                if (nextMatchInW) {
                    const slot = matchIndex % 2;
                    if (winnerId) nextMatchInW.players[slot] = winnerId;
                    else nextMatchInW.players[slot] = null;
                }
                if (nextRoundIndex === W.length && GF) {
                    if (winnerId) GF.players[0] = winnerId;
                    else GF.players[0] = null;
                }

                if (roundIndex < L.length) {
                    const lrMatches = L[roundIndex].matches;
                    const lrMatchIndex = roundIndex === 0 ? Math.floor(matchIndex / 2) : Math.min(matchIndex, lrMatches.length - 1);
                    const lrSlot = roundIndex === 0 ? matchIndex % 2 : 0;
                    const skipLoser = roundIndex > 0 && lrMatches.length === 1 && matchIndex > 0;
                    if (!skipLoser && lrMatchIndex >= 0 && lrMatchIndex < lrMatches.length) {
                        if (loserId != null) lrMatches[lrMatchIndex].players[lrSlot] = loserId;
                        else lrMatches[lrMatchIndex].players[lrSlot] = null;
                    }
                }
                applyByeWinners(next);
                propagateAllWinners(next);
                return { ...prev, doubleElim: next };
            }

            if (bracket === 'losers') {
                const match = L[roundIndex].matches[matchIndex];
                match.winnerId = winnerId;
                const nextLr = roundIndex + 1;
                if (nextLr < L.length) {
                    const nextRoundMatches = L[nextLr].matches;
                    const nextMatchIndex = nextRoundMatches.length === 1 ? 0 : matchIndex;
                    const nextMatch = nextRoundMatches[nextMatchIndex];
                    const slot = (nextRoundMatches.length === 1 && matchIndex > 0) ? -1 : 1;
                    if (nextMatch && slot >= 0) {
                        if (winnerId) nextMatch.players[slot] = winnerId;
                        else nextMatch.players[slot] = null;
                    }
                } else if (GF) {
                    if (winnerId) GF.players[1] = winnerId;
                    else GF.players[1] = null;
                }
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
