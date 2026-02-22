
import React, { useRef, useLayoutEffect, useState } from 'react';
import type { TournamentMatch, TournamentPlayer } from '../../types';

interface BracketTreeProps {
    rounds: { title: string; matches: TournamentMatch[] }[];
    roundFilter?: (roundIndex: number, matchIndex: number) => boolean;
    handleSetMatchWinner: (roundIndex: number, matchIndex: number, playerId: string) => void;
}

const SLOT_HEIGHT = 32;
const MATCH_GAP = 8;

export const BracketTree = (props: BracketTreeProps) => {
    const { rounds, roundFilter, handleSetMatchWinner } = props;
    const containerRef = useRef<HTMLDivElement>(null);
    const [paths, setPaths] = useState<string[]>([]);
    const [winnerPaths, setWinnerPaths] = useState<string[]>([]);

    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const rects = new Map<string, DOMRect>();
        container.querySelectorAll('[data-match-key]').forEach(el => {
            const key = el.getAttribute('data-match-key');
            if (key) rects.set(key, el.getBoundingClientRect());
        });
        const containerRect = container.getBoundingClientRect();

        const fromRightCenter = (r: DOMRect) => ({
            x: r.right - containerRect.left,
            y: r.top - containerRect.top + r.height / 2
        });
        const toLeftCenter = (r: DOMRect) => ({
            x: r.left - containerRect.left,
            y: r.top - containerRect.top + r.height / 2
        });

        const allPaths: string[] = [];
        const winPaths: string[] = [];

        for (let r = 0; r < rounds.length - 1; r++) {
            const round = rounds[r];
            const nextRound = rounds[r + 1];
            const isFinal = nextRound.title.includes('결승');
            for (let m = 0; m < round.matches.length; m++) {
                if (roundFilter && !roundFilter(r, m)) continue;
                const nextM = isFinal ? (m < 2 ? Math.floor(m / 2) : 1) : Math.floor(m / 2);
                const nextMatch = nextRound.matches[nextM];
                if (!nextMatch) continue;

                const keyFrom = `${r}-${m}`;
                const keyTo = `${r + 1}-${nextM}`;
                const fromRect = rects.get(keyFrom);
                const toRect = rects.get(keyTo);
                if (!fromRect || !toRect) continue;

                const from = fromRightCenter(fromRect);
                const to = toLeftCenter(toRect);
                const midX = (from.x + to.x) / 2;
                const path = `M ${from.x} ${from.y} H ${midX} V ${to.y} H ${to.x}`;
                allPaths.push(path);

                const match = round.matches[m];
                if (match.winnerId) winPaths.push(path);
            }
        }
        setPaths(allPaths);
        setWinnerPaths(winPaths);
    }, [rounds, roundFilter]);

    const getMatchKey = (ri: number, mi: number) => `${ri}-${mi}`;

    return (
        <div ref={containerRef} className="bracket-tree">
            <svg className="bracket-connectors" preserveAspectRatio="none">
                <defs>
                    <linearGradient id="connectorGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="var(--border-color)" />
                        <stop offset="100%" stopColor="var(--primary-color)" />
                    </linearGradient>
                </defs>
                {paths.map((p, i) => (
                    <path key={`conn-${i}`} d={p} fill="none" stroke="#ddd" strokeWidth="1.5" />
                ))}
                {winnerPaths.map((p, i) => (
                    <path key={`win-${i}`} d={p} fill="none" stroke="var(--primary-color)" strokeWidth="2.5" strokeLinecap="round" />
                ))}
            </svg>
            <div className="bracket-tree-columns">
                {rounds.map((round, roundIndex) => {
                    const isFinal = round.title.includes('결승');
                    const baseCount = rounds[0].matches.length;
                    const pow = Math.log2(baseCount);
                    return (
                        <div key={roundIndex} className="bracket-round-col">
                            <h4 className="bracket-round-title">{round.title}</h4>
                            <div 
                                className="bracket-round-matches"
                                style={{
                                    gap: MATCH_GAP,
                                    minHeight: baseCount * (SLOT_HEIGHT * 2 + MATCH_GAP)
                                }}
                            >
                                {round.matches.map((match, matchIndex) => {
                                    if (roundFilter && !roundFilter(roundIndex, matchIndex)) return null;
                                    const player1 = match.players[0];
                                    const player2 = match.players[1];
                                    const key = getMatchKey(roundIndex, matchIndex);
                                    const yOffset = (2 * matchIndex + 1) * Math.pow(2, pow - 1 - roundIndex) * (SLOT_HEIGHT + MATCH_GAP / 2);
                                    return (
                                        <div
                                            key={match.id}
                                            className="bracket-match-cell"
                                            data-match-key={key}
                                            style={{ marginTop: roundIndex === 0 ? 0 : undefined }}
                                        >
                                            {isFinal && (
                                                <h5 className="bracket-match-label">{matchIndex === 0 ? '결승' : '3/4위전'}</h5>
                                            )}
                                            <div className="bracket-match">
                                                <div
                                                    className={`bracket-player ${match.winnerId === (player1 as TournamentPlayer)?.studentId ? 'winner' : ''} ${player1 && player1 !== 'BYE' && player2 && player2 !== 'BYE' ? 'clickable' : ''}`}
                                                    onClick={() => player1 && player1 !== 'BYE' && player2 && player2 !== 'BYE' && handleSetMatchWinner(roundIndex, matchIndex, (player1 as TournamentPlayer).studentId)}
                                                >
                                                    {player1 === 'BYE' ? '부전승' : player1?.name || '...'}
                                                </div>
                                                <div
                                                    className={`bracket-player ${match.winnerId === (player2 as TournamentPlayer)?.studentId ? 'winner' : ''} ${player1 && player1 !== 'BYE' && player2 && player2 !== 'BYE' ? 'clickable' : ''}`}
                                                    onClick={() => player2 && player2 !== 'BYE' && player1 && player1 !== 'BYE' && handleSetMatchWinner(roundIndex, matchIndex, (player2 as TournamentPlayer).studentId)}
                                                >
                                                    {player2 === 'BYE' ? '' : player2?.name || '...'}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
