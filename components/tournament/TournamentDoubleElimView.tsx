
import React, { useState } from 'react';
import type { Student, TournamentData, DoubleElimData, DoubleElimMatch } from '../../types';
import { generateId } from '../../utils';
import { DoubleElimBracketTree } from './DoubleElimBracketTree';
import { DoubleElimResultPanel } from './DoubleElimResultPanel';

interface TournamentDoubleElimViewProps {
    data: TournamentData;
    students: Student[];
    setData: React.Dispatch<React.SetStateAction<TournamentData>>;
    onOpenPlayerManagement: () => void;
}

function buildDoubleElim(participantIds: string[]): DoubleElimData {
    const n = participantIds.length;
    const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);
    const createMatch = (): DoubleElimMatch => ({ id: generateId(), players: [null, null], winnerId: null });

    // 6인: 부전승 2명을 묶어서 다음 라운드 한 경기로 대진 (실제 경기 2개 + 부전승 1경기)
    if (n === 6) {
        const shuffled = shuffle([...participantIds]);
        const winnersRounds: { title: string; matches: DoubleElimMatch[] }[] = [];
        const losersRounds: { title: string; matches: DoubleElimMatch[] }[] = [];

        const r1m0 = createMatch();
        r1m0.players = [shuffled[0], shuffled[1]];
        const r1m1 = createMatch();
        r1m1.players = [shuffled[2], shuffled[3]];
        winnersRounds.push({ title: '4강', matches: [r1m0, r1m1] });

        const r2m0 = createMatch();
        r2m0.players = [null, null];
        const r2m1 = createMatch();
        r2m1.players = [shuffled[4], shuffled[5]]; // 부전승 둘을 다음 라운드에서 맞붙게
        winnersRounds.push({ title: '승자 결승', matches: [r2m0, r2m1] });

        const r3m0 = createMatch();
        r3m0.players = [null, null];
        winnersRounds.push({ title: '승자 결승', matches: [r3m0] });

        losersRounds.push({ title: '패자조 R1', matches: [createMatch()] });
        losersRounds.push({ title: '패자조 R2', matches: [createMatch()] });

        const grandFinal = createMatch();
        const built: DoubleElimData = { winnersRounds, losersRounds, grandFinal, playerIds: participantIds };
        propagateAllWinners(built);
        return built;
    }

    const size = Math.pow(2, Math.ceil(Math.log2(Math.max(2, n))));
    const players = [...participantIds];
    while (players.length < size) players.push('BYE');
    const shuffled = shuffle(players);

    const winnersRounds: { title: string; matches: DoubleElimMatch[] }[] = [];
    const losersRounds: { title: string; matches: DoubleElimMatch[] }[] = [];

    let prevMatches: DoubleElimMatch[] = [];
    const half = size / 2;
    for (let i = 0; i < half; i++) {
        const m = createMatch();
        m.players = [shuffled[i * 2], shuffled[i * 2 + 1]];
        if (m.players[0] === 'BYE') m.winnerId = m.players[1] as string;
        else if (m.players[1] === 'BYE') m.winnerId = m.players[0] as string;
        prevMatches.push(m);
    }
    const firstTitle = size === 2 ? '결승' : size === 4 ? '준결승' : `${size}강`;
    winnersRounds.push({ title: firstTitle, matches: prevMatches });

    let roundSize = half;
    while (roundSize > 1) {
        const nextMatches: DoubleElimMatch[] = [];
        for (let i = 0; i < roundSize / 2; i++) nextMatches.push(createMatch());
        winnersRounds.push({
            title: roundSize === 2 ? '승자 결승' : `${roundSize}강`,
            matches: nextMatches,
        });
        prevMatches = nextMatches;
        roundSize = roundSize / 2;
    }

    const numWRounds = winnersRounds.length;
    for (let lr = 0; lr < numWRounds; lr++) {
        const wCount = winnersRounds[lr].matches.length;
        const matchCount = lr === 0 ? Math.max(1, Math.floor(wCount / 2)) : Math.max(1, wCount);
        const lm: DoubleElimMatch[] = [];
        for (let i = 0; i < matchCount; i++) lm.push(createMatch());
        losersRounds.push({ title: `패자조 R${lr + 1}`, matches: lm });
    }

    const grandFinal = createMatch();
    const built: DoubleElimData = { winnersRounds, losersRounds, grandFinal, playerIds: participantIds };
    propagateAllWinners(built);
    return built;
}

function propagateAllWinners(data: DoubleElimData) {
    const W = data.winnersRounds;
    const L = data.losersRounds;
    const GF = data.grandFinal!;
    for (let r = 0; r < W.length; r++) {
        for (let m = 0; m < W[r].matches.length; m++) {
            const match = W[r].matches[m];
            const winnerId = match.winnerId;
            if (!winnerId) continue;
            const nextR = r + 1;
            if (nextR < W.length) {
                const nextMatch = W[nextR].matches[Math.floor(m / 2)];
                if (nextMatch) nextMatch.players[m % 2] = winnerId;
            } else if (GF) GF.players[0] = winnerId;
            const loserId = getLoserFromMatch(match, winnerId);
            if (loserId != null && r < L.length) {
                const lrMatchIdx = r === 0 ? Math.floor(m / 2) : Math.min(m, L[r].matches.length - 1);
                const lrSlot = r === 0 ? m % 2 : 0;
                if (r > 0 && L[r].matches.length === 1 && m > 0) continue;
                if (lrMatchIdx >= 0 && L[r].matches[lrMatchIdx]) L[r].matches[lrMatchIdx].players[lrSlot] = loserId;
            }
        }
    }
    for (let r = 0; r < L.length; r++) {
        for (let m = 0; m < L[r].matches.length; m++) {
            const match = L[r].matches[m];
            const winnerId = match.winnerId;
            if (!winnerId) continue;
            const nextR = r + 1;
            if (nextR < L.length) {
                const nextRound = L[nextR].matches;
                const nextIdx = nextRound.length === 1 ? 0 : m;
                const slot = nextRound.length === 1 && m > 0 ? -1 : 1;
                if (nextRound[nextIdx] && slot >= 0) nextRound[nextIdx].players[slot] = winnerId;
            } else if (GF) GF.players[1] = winnerId;
        }
    }
}

function getLoserFromMatch(match: DoubleElimMatch, winnerId: string | null): string | null {
    if (!winnerId) return null;
    const other = match.players.find(p => p && p !== 'BYE' && p !== winnerId);
    return (other as string) || null;
}

export const TournamentDoubleElimView = (props: TournamentDoubleElimViewProps) => {
    const { data, students, setData, onOpenPlayerManagement } = props;
    const doubleElim = data.doubleElim;
    const participantIds = data.doubleElimParticipantIds || [];

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
        setData(prev => ({
            ...prev,
            doubleElimParticipantIds: ids,
            doubleElim: buildDoubleElim(ids),
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
                return { ...prev, doubleElim: next };
            }

            return prev;
        });
    };

    const handleReset = () => {
        if (!window.confirm('더블엘리미네이션을 초기화하시겠습니까?')) return;
        setData(prev => ({ ...prev, doubleElim: undefined, doubleElimParticipantIds: [] }));
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
                        <div className="bracket-wrapper" style={{ textAlign: 'center', padding: '3rem' }}>
                            <p style={{ marginBottom: '1rem' }}>더블엘리미네이션 대진이 없습니다. 선수 관리에서 참가자를 선택한 뒤 시작하세요.</p>
                            <button className="btn primary" onClick={handleStart} disabled={participantIds.length < 2}>
                                더블엘리미네이션 시작
                            </button>
                        </div>
                    </div>
                    <DoubleElimResultPanel doubleElim={null} students={students} isFinished={false} />
                </div>
            </div>
        );
    }

    return (
        <div className="tournament-doubleelim-view">
            <div className="bracket-controls">
                <button className="btn" onClick={onOpenPlayerManagement}>선수 관리</button>
                <button className="btn danger" onClick={handleReset}>초기화</button>
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
                />
            </div>
        </div>
    );
};
