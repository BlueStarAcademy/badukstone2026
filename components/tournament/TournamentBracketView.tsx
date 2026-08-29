
import React, { useState } from 'react';
import type { Student, TournamentAwardRequest, TournamentBracket, TournamentData, TournamentSettings, TournamentMatch, TournamentPlayer } from '../../types';
import { ConfirmationModal } from '../modals/ConfirmationModal';
import { TournamentPrizeModal } from './TournamentPrizeModal';
import { parseRank, generateId } from '../../utils';
import { buildElimRoundOneSlotOrder, DEFAULT_BYE_PRIORITY } from '../../utils/byePlacement';
import type { BracketPrizeSettingsKey, TournamentBracketPrizeModalMode } from '../../utils/tournamentPrizes';
import {
    getBracketOrderedPlacementIds,
    buildBracketStyleGrants,
    getBracketPaidRankCount,
    type BracketPrizePayout,
} from '../../utils/tournamentPrizes';
import { BracketTree } from './BracketTree';

interface TournamentBracketViewProps {
    data: TournamentData;
    students: Student[];
    setData: React.Dispatch<React.SetStateAction<TournamentData>>;
    settings: TournamentSettings;
    onAwardBatch: (request: TournamentAwardRequest) => boolean;
    awardEventKey: string;
    onOpenPlayerManagement: () => void;
    /** 시상 시 조별 상금 출처 (예선+본선 본선은 hybridBracket) */
    bracketPrizeKey?: BracketPrizeSettingsKey;
    prizeModalMode?: TournamentBracketPrizeModalMode;
}

/** 상대가 없을 때(부전승): 한 명만 있으면 그 선수를 승자로 설정 */
const applyByeWinnersToBracket = (bracket: TournamentBracket) => {
    bracket.rounds.forEach(round => {
        round.matches.forEach(match => {
            const p1 = match.players[0];
            const p2 = match.players[1];
            const only1 = p1 && p1 !== 'BYE' && (!p2 || p2 === 'BYE');
            const only2 = p2 && p2 !== 'BYE' && (!p1 || p1 === 'BYE');
            if (only1) match.winnerId = (p1 as TournamentPlayer).studentId;
            else if (only2) match.winnerId = (p2 as TournamentPlayer).studentId;
        });
    });
};

const getRestRankingsByRound = (
    bracketData: TournamentBracket,
    students: Student[],
    top4Ids: Set<string>
): { title: string; players: Student[] }[] => {
    const result: { title: string; players: Student[] }[] = [];
    const finalRoundIndex = bracketData.rounds.length - 1;
    for (let ri = 0; ri < finalRoundIndex; ri++) {
        const round = bracketData.rounds[ri];
        const losers: Student[] = [];
        for (const match of round.matches) {
            if (!match.winnerId) continue;
            for (const p of match.players) {
                if (p && p !== 'BYE' && (p as TournamentPlayer).studentId !== match.winnerId) {
                    const id = (p as TournamentPlayer).studentId;
                    if (!top4Ids.has(id)) {
                        const s = students.find(st => st.id === id);
                        if (s) losers.push(s);
                    }
                }
            }
        }
        if (losers.length > 0) result.push({ title: round.title, players: losers });
    }
    return result.reverse();
};

const TournamentResultPanel = ({
    bracketData,
    students,
    isFinished,
    onOpenPrizeModal,
}: {
    bracketData: TournamentBracket | null;
    students: Student[];
    isFinished: boolean;
    onOpenPrizeModal?: () => void;
}) => {
    const [restRankOpen, setRestRankOpen] = useState(false);

    if (!bracketData) {
        return (
            <div className="bracket-result-panel">
                <div className="bracket-result-box bracket-result-placeholder">
                    <div className="bracket-result-crown" aria-hidden>🏆</div>
                    <h3 className="bracket-result-title">최종 결과</h3>
                    <p className="bracket-result-message">대진표를 생성하면<br />결과가 여기에 표시됩니다</p>
                </div>
            </div>
        );
    }
    if (!isFinished) {
        return (
            <div className="bracket-result-panel">
                <div className="bracket-result-box bracket-result-placeholder">
                    <div className="bracket-result-crown" aria-hidden>🏆</div>
                    <h3 className="bracket-result-title">최종 결과</h3>
                    <p className="bracket-result-message">경기가 종료되면<br />우승·준우승·3·4위가 표시됩니다</p>
                </div>
            </div>
        );
    }

    const finalRound = bracketData.rounds[bracketData.rounds.length - 1];
    const semiFinalRound = bracketData.rounds.find(r => r.title === '4강전' || r.title === '준결승');
    const championId = finalRound.matches[0].winnerId;
    const champion = championId ? students.find(s => s.id === championId) : null;
    const runnerUpPlayer = finalRound.matches[0].players.find(p => p && p !== 'BYE' && p.studentId !== championId);
    const runnerUp = runnerUpPlayer ? students.find(s => s.id === (runnerUpPlayer as TournamentPlayer).studentId) : null;
    let thirdPlace: Student | null = null;
    let fourthPlace: Student | null = null;
    if (finalRound.matches.length > 1 && finalRound.matches[1]) {
        const m = finalRound.matches[1];
        if (m.winnerId) thirdPlace = students.find(s => s.id === m.winnerId) || null;
        const fourthPlayer = m.players.find(p => p && p !== 'BYE' && p.studentId !== m.winnerId);
        if (fourthPlayer) fourthPlace = students.find(s => s.id === (fourthPlayer as TournamentPlayer).studentId) || null;
    } else if (semiFinalRound) {
        const losers = semiFinalRound.matches.flatMap(m => m.players)
            .filter((p): p is TournamentPlayer => !!(p && p !== 'BYE' && p.studentId !== championId && p.studentId !== runnerUp?.id))
            .map(p => students.find(s => s.id === p.studentId) || null);
        thirdPlace = losers[0] ?? null;
        fourthPlace = losers[1] ?? null;
    }

    const top4Ids = new Set([championId, runnerUp?.id, thirdPlace?.id, fourthPlace?.id].filter(Boolean) as string[]);
    const restByRound = getRestRankingsByRound(bracketData, students, top4Ids);
    const hasRest = restByRound.some(g => g.players.length > 0);

    return (
        <div className="bracket-result-panel">
            <div className="bracket-result-box bracket-result-filled">
                <div className="bracket-result-glow" aria-hidden />
                <h3 className="bracket-result-title">최종 결과</h3>
                <div className="bracket-result-rows">
                    {champion && <div className="bracket-result-row rank-1"><span className="bracket-result-icon" aria-hidden>🥇</span><span className="bracket-result-text">우승 {champion.name} <span className="bracket-result-meta">({champion.rank})</span></span></div>}
                    {runnerUp && <div className="bracket-result-row rank-2"><span className="bracket-result-icon" aria-hidden>🥈</span><span className="bracket-result-text">준우승 {runnerUp.name} <span className="bracket-result-meta">({runnerUp.rank})</span></span></div>}
                    {thirdPlace && <div className="bracket-result-row rank-3"><span className="bracket-result-icon" aria-hidden>🥉</span><span className="bracket-result-text">3위 {thirdPlace.name} <span className="bracket-result-meta">({thirdPlace.rank})</span></span></div>}
                    {fourthPlace && <div className="bracket-result-row rank-4"><span className="bracket-result-icon" aria-hidden>4</span><span className="bracket-result-text">4위 {fourthPlace.name} <span className="bracket-result-meta">({fourthPlace.rank})</span></span></div>}
                </div>
                <div className="bracket-result-actions">
                    {onOpenPrizeModal && <button type="button" className="btn primary" onClick={onOpenPrizeModal}>순위 보상</button>}
                    {hasRest && <button type="button" className="btn bracket-result-rest-btn" onClick={() => setRestRankOpen(true)}>5위 이하 순위보기</button>}
                </div>
            </div>
            {restRankOpen && (
                <div className="bracket-rest-rank-overlay" onClick={() => setRestRankOpen(false)} role="dialog" aria-modal="true" aria-label="5위 이하 순위">
                    <div className="bracket-rest-rank-modal" onClick={e => e.stopPropagation()}>
                        <div className="bracket-rest-rank-header">
                            <h4>5위 이하 순위</h4>
                            <button type="button" className="bracket-rest-rank-close" onClick={() => setRestRankOpen(false)} aria-label="닫기">×</button>
                        </div>
                        <div className="bracket-rest-rank-body">
                            {restByRound.map((g, i) => (
                                <div key={i} className="bracket-rest-rank-group">
                                    <span className="bracket-rest-rank-label">{g.title} 탈락</span>
                                    <span className="bracket-rest-rank-names">{g.players.map(p => p.name).join(', ')}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


export const TournamentBracketView = (props: TournamentBracketViewProps) => {
    const {
        data,
        students,
        setData,
        settings,
        onAwardBatch,
        awardEventKey,
        onOpenPlayerManagement,
        bracketPrizeKey = 'bracket',
        prizeModalMode = 'bracket',
    } = props;
    const { bracket: bracketData, bracketParticipantIds } = data;

    const [confirmation, setConfirmation] = useState<{ message: React.ReactNode, actions: any[] } | null>(null);
    const [isPrizeModalOpen, setIsPrizeModalOpen] = useState(false);
    const [bracketTab, setBracketTab] = useState(0);

    const handleGenerateBracket = () => {
        const participants = (bracketParticipantIds || [])
            .map(id => students.find(s => s.id === id))
            .filter((s): s is Student => !!s)
            .sort((a, b) => parseRank(b.rank) - parseRank(a.rank)); 
        
        if (participants.length < 2) {
            alert('토너먼트를 생성하려면 최소 2명의 참가자가 필요합니다.');
            return;
        }

        const tournamentPlayers: TournamentPlayer[] = participants.map(p => ({
            studentId: p.id, name: p.name, rank: p.rank,
            game1Handicap: 0, game1Color: 'black', game1Result: null,
            game2Score: null, game2LastStone: false, game3Score: null,
        }));

        const byePriority = settings.byePriority ?? DEFAULT_BYE_PRIORITY;
        const { bracketSize, slots: playersForRound1 } = buildElimRoundOneSlotOrder(tournamentPlayers, byePriority, true);
        
        const firstRoundMatches: TournamentMatch[] = [];
        for (let i = 0; i < playersForRound1.length; i += 2) {
            firstRoundMatches.push({
                id: generateId(),
                players: [playersForRound1[i], playersForRound1[i + 1] || null],
                winnerId: null,
            });
        }
        
        firstRoundMatches.forEach(match => {
            const player1 = match.players[0];
            if (player1 !== 'BYE' && player1 !== null && match.players[1] === 'BYE') {
                match.winnerId = player1.studentId;
            }
        });
        
        let firstTitle = `${bracketSize}강`;
        if (bracketSize === 4) firstTitle = '4강전';
        if (bracketSize === 2) firstTitle = '결승';

        const rounds = [{ title: firstTitle, matches: firstRoundMatches }];
        let currentRoundMatches = firstRoundMatches;
        let currentRoundSize = bracketSize;
        
        while (currentRoundSize > 4) {
            const nextRoundSize = currentRoundSize / 2;
            const nextRoundMatches: TournamentMatch[] = [];
            for (let i = 0; i < nextRoundSize / 2; i++) {
                nextRoundMatches.push({ 
                    id: generateId(), 
                    players: [null, null], 
                    winnerId: null,
                });
            }
            const nextRoundTitle = nextRoundSize === 4 ? '4강전' : `${nextRoundSize}강`;
            rounds.push({ title: nextRoundTitle, matches: nextRoundMatches });
            currentRoundSize = nextRoundSize;
        }

        if (currentRoundSize === 4 || (bracketSize <= 4 && rounds.length === 1 && rounds[0].title === '4강전')) { 
            const finalMatch = { id: generateId(), players: [null, null], winnerId: null };
            const thirdPlaceMatch = { id: generateId(), players: [null, null], winnerId: null };
            rounds.push({ title: '결승 & 3/4위전', matches: [finalMatch, thirdPlaceMatch] });
        } else if (bracketSize === 2 && rounds.length === 1 && rounds[0].title === '결승') {
             // 2 players only
        }

        setData(prev => ({
            ...prev,
            bracket: { rounds, players: tournamentPlayers },
            awardSessionIds: { ...prev.awardSessionIds, bracket: generateId() },
        }));
    };
    
    const handleSetMatchWinner = (roundIndex: number, matchIndex: number, clickedPlayerId: string) => {
        setData(prev => {
            if (!prev.bracket) return prev;
            const newBracket = JSON.parse(JSON.stringify(prev.bracket)) as TournamentBracket;
            
            const match = newBracket.rounds[roundIndex].matches[matchIndex];
            const newWinnerId = match.winnerId === clickedPlayerId ? null : clickedPlayerId;
            match.winnerId = newWinnerId;
    
            // Reset subsequent rounds
            for (let rIdx = roundIndex + 1; rIdx < newBracket.rounds.length; rIdx++) {
                for (let mIdx = 0; mIdx < newBracket.rounds[rIdx].matches.length; mIdx++) {
                    const currentMatch = newBracket.rounds[rIdx].matches[mIdx];
                    currentMatch.players = [null, null];
                    currentMatch.winnerId = null;
                }
            }
            
            // Advance winners/losers
            for (let rIdx = roundIndex; rIdx < newBracket.rounds.length - 1; rIdx++) {
                const currentRound = newBracket.rounds[rIdx];
                const nextRound = newBracket.rounds[rIdx + 1];
    
                if ((currentRound.title === '4강전' || currentRound.title === '준결승') && nextRound.title.includes('결승')) {
                     const semi1 = currentRound.matches[0];
                     const semi2 = currentRound.matches[1];
                     const finalMatch = nextRound.matches[0];
                     const thirdPlaceMatch = nextRound.matches[1];
    
                     const winner1 = semi1.winnerId ? newBracket.players.find(p => p.studentId === semi1.winnerId) : null;
                     const loser1Player = semi1.players.find(p => p && p !== 'BYE' && p.studentId !== semi1.winnerId);
                     const loser1 = loser1Player ? newBracket.players.find(p => p.studentId === (loser1Player as TournamentPlayer).studentId) : null;
    
                     const winner2 = semi2.winnerId ? newBracket.players.find(p => p.studentId === semi2.winnerId) : null;
                     const loser2Player = semi2.players.find(p => p && p !== 'BYE' && p.studentId !== semi2.winnerId);
                     const loser2 = loser2Player ? newBracket.players.find(p => p.studentId === (loser2Player as TournamentPlayer).studentId) : null;
    
                     finalMatch.players[0] = winner1 || null;
                     finalMatch.players[1] = winner2 || null;
                     if (thirdPlaceMatch) {
                        if (semi1.winnerId && semi2.winnerId) {
                            thirdPlaceMatch.players[0] = loser1 || null;
                            thirdPlaceMatch.players[1] = loser2 || null;
                        } else {
                            thirdPlaceMatch.players[0] = null;
                            thirdPlaceMatch.players[1] = null;
                        }
                     }
                } else {
                     for (let mIdx = 0; mIdx < currentRound.matches.length; mIdx++) {
                        const winnerId = currentRound.matches[mIdx].winnerId;
                        if (winnerId) {
                            const winner = newBracket.players.find(p => p.studentId === winnerId);
                            const nextMatchIndex = Math.floor(mIdx / 2);
                            const playerSlot = mIdx % 2;
                            if (nextRound.matches[nextMatchIndex]) {
                                nextRound.matches[nextMatchIndex].players[playerSlot] = winner || null;
                            }
                        }
                    }
                }
            }
            applyByeWinnersToBracket(newBracket);
            return { ...prev, bracket: newBracket };
        });
    };

    const handleResetBracket = () => {
         setConfirmation({
            message: "정말 대진표를 초기화하시겠습니까? 모든 경기 결과가 사라집니다.",
            actions: [
                { text: '취소', onClick: () => setConfirmation(null) },
                {
                    text: '초기화', className: 'danger', onClick: () => {
                        setData(prev => ({ ...prev, bracket: null }));
                        setConfirmation(null);
                    }
                }
            ]
        });
    };
    
    const handleAwardPrizes = (prizes: BracketPrizePayout) => {
        if (!bracketData) return;
        const placementIds = getBracketOrderedPlacementIds(bracketData);
        const grants = buildBracketStyleGrants(
            placementIds,
            prizes,
            getBracketPaidRankCount(settings),
            prizeModalMode === 'hybridBracket' ? '본선 토너먼트' : '토너먼트'
        );
        const mode = prizeModalMode === 'hybridBracket' ? 'hybrid' : 'bracket';
        if (onAwardBatch({
            eventKey: awardEventKey,
            mode,
            label: prizeModalMode === 'hybridBracket' ? '예선+본선 본선 결과' : '토너먼트 결과',
            grants,
            metadata: { phase: 'final' },
        })) setIsPrizeModalOpen(false);
    };

    if (!bracketData) {
        return (
            <div className="tournament-bracket-view">
                <div className="bracket-controls">
                    <button className="btn" onClick={onOpenPlayerManagement}>선수 관리</button>
                </div>
                <div className="bracket-view-body">
                    <div className="bracket-main">
                        <div className="bracket-wrapper tournament-empty-state">
                            <span className="tournament-empty-kicker">BRACKET SETUP</span>
                            <h3>대진표 준비</h3>
                            <p>대진표가 없습니다. '선수 관리'에서 참가자를 선택하고 대진표를 생성해주세요.</p>
                            <div className="tournament-empty-actions">
                                <button className="btn primary" onClick={handleGenerateBracket} disabled={(bracketParticipantIds || []).length < 2}>대진표 생성</button>
                            </div>
                        </div>
                    </div>
                    <TournamentResultPanel bracketData={null} students={students} isFinished={false} />
                </div>
            </div>
        );
    }
    
    const isFinished = bracketData.rounds[bracketData.rounds.length - 1].matches.every(m => m.winnerId);
    const firstRoundCount = bracketData.rounds[0]?.matches.length ?? 0;
    const MATCHES_PER_TAB = 4;
    const useBracketTabs = firstRoundCount > MATCHES_PER_TAB;
    const tabCount = useBracketTabs ? Math.ceil(firstRoundCount / MATCHES_PER_TAB) : 1;

    const renderBracketBody = () => {
        const rounds = bracketData.rounds;
        if (useBracketTabs) {
            const tabs = Array.from({ length: tabCount }, (_, t) => {
                const startMatch = t * MATCHES_PER_TAB;
                const endMatch = Math.min((t + 1) * MATCHES_PER_TAB, firstRoundCount);
                return {
                    label: `${startMatch + 1}~${endMatch}경기`,
                    roundFilter: (ri: number, mi: number) => {
                        const start = t * (MATCHES_PER_TAB / Math.pow(2, ri));
                        const end = (t + 1) * (MATCHES_PER_TAB / Math.pow(2, ri));
                        return mi >= Math.floor(start) && mi < Math.ceil(end);
                    }
                };
            });
            const t = tabs[Math.min(bracketTab, tabs.length - 1)];
            return (
                <>
                    <div className="group-tab-buttons tournament-subnav">
                        {tabs.map((tab, i) => (
                            <button key={i} className={`tab-btn ${bracketTab === i ? 'active' : ''}`} onClick={() => setBracketTab(i)}>{tab.label}</button>
                        ))}
                    </div>
                    <BracketTree
                        rounds={rounds}
                        roundFilter={t.roundFilter}
                        handleSetMatchWinner={handleSetMatchWinner}
                    />
                </>
            );
        }
        return <BracketTree rounds={rounds} handleSetMatchWinner={handleSetMatchWinner} />;
    };

    return (
        <div className="tournament-bracket-view">
            <div className="bracket-controls">
                <button className="btn" onClick={onOpenPlayerManagement}>선수 관리</button>
                <button className="btn danger" onClick={handleResetBracket}>대진표 초기화</button>
            </div>
            <div className="bracket-view-body">
                <div className="bracket-main">
                    <div className="bracket-wrapper">
                        {renderBracketBody()}
                    </div>
                </div>
                <TournamentResultPanel
                    bracketData={bracketData}
                    students={students}
                    isFinished={!!bracketData && isFinished}
                    onOpenPrizeModal={isFinished ? () => setIsPrizeModalOpen(true) : undefined}
                />
            </div>
            {isPrizeModalOpen && (
                <TournamentPrizeModal
                    isOpen={isPrizeModalOpen}
                    onClose={() => setIsPrizeModalOpen(false)}
                    settings={settings}
                    prizeKey={bracketPrizeKey}
                    mode={prizeModalMode}
                    onAwardPrizes={handleAwardPrizes}
                />
            )}
            {confirmation && <ConfirmationModal {...confirmation} onClose={() => setConfirmation(null)} />}
        </div>
    );
};
