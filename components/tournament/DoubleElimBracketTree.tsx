
import React, { useRef, useLayoutEffect, useState } from 'react';
import type { DoubleElimMatch } from '../../types';

const SLOT_HEIGHT = 32;
const MATCH_GAP = 8;

interface DoubleElimBracketTreeProps {
    rounds: { title: string; matches: DoubleElimMatch[] }[];
    getPlayerName: (id: string | 'BYE' | null) => string;
    onSetWinner: (roundIndex: number, matchIndex: number, winnerId: string | null) => void;
    /** prefix for data-match-key (e.g. 'w' or 'l') */
    keyPrefix?: string;
}

export const DoubleElimBracketTree = (props: DoubleElimBracketTreeProps) => {
    const { rounds, getPlayerName, onSetWinner, keyPrefix = '' } = props;
    const containerRef = useRef<HTMLDivElement>(null);
    const [paths, setPaths] = useState<string[]>([]);
    const [winnerPaths, setWinnerPaths] = useState<string[]>([]);

    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container || rounds.length < 2) return;

        const rects = new Map<string, DOMRect>();
        container.querySelectorAll('[data-match-key]').forEach(el => {
            const key = el.getAttribute('data-match-key');
            if (key) rects.set(key, el.getBoundingClientRect());
        });
        const containerRect = container.getBoundingClientRect();
        const fromRightCenter = (r: DOMRect) => ({ x: r.right - containerRect.left, y: r.top - containerRect.top + r.height / 2 });
        const toLeftCenter = (r: DOMRect) => ({ x: r.left - containerRect.left, y: r.top - containerRect.top + r.height / 2 });

        const allPaths: string[] = [];
        const winPaths: string[] = [];
        for (let r = 0; r < rounds.length - 1; r++) {
            const round = rounds[r];
            const nextRound = rounds[r + 1];
            for (let m = 0; m < round.matches.length; m++) {
                const nextM = Math.floor(m / 2);
                const nextMatch = nextRound.matches[nextM];
                if (!nextMatch) continue;
                const keyFrom = `${keyPrefix}${r}-${m}`;
                const keyTo = `${keyPrefix}${r + 1}-${nextM}`;
                const fromRect = rects.get(keyFrom);
                const toRect = rects.get(keyTo);
                if (!fromRect || !toRect) continue;
                const from = fromRightCenter(fromRect);
                const to = toLeftCenter(toRect);
                const midX = (from.x + to.x) / 2;
                const path = `M ${from.x} ${from.y} H ${midX} V ${to.y} H ${to.x}`;
                allPaths.push(path);
                if (round.matches[m].winnerId) winPaths.push(path);
            }
        }
        setPaths(allPaths);
        setWinnerPaths(winPaths);
    }, [rounds, keyPrefix]);

    const baseCount = rounds[0]?.matches.length ?? 1;

    return (
        <div ref={containerRef} className="bracket-tree doubleelim-tree">
            <svg className="bracket-connectors" preserveAspectRatio="none">
                <defs>
                    <marker id="de-arrowhead" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
                        <polygon points="0 0, 10 4, 0 8" fill="#999" />
                    </marker>
                    <marker id="de-arrowhead-win" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
                        <polygon points="0 0, 10 4, 0 8" fill="var(--primary-color)" />
                    </marker>
                </defs>
                {paths.map((p, i) => <path key={i} d={p} fill="none" stroke="#ddd" strokeWidth="1.5" markerEnd="url(#de-arrowhead)" />)}
                {winnerPaths.map((p, i) => <path key={i} d={p} fill="none" stroke="var(--primary-color)" strokeWidth="2.5" strokeLinecap="round" markerEnd="url(#de-arrowhead-win)" />)}
            </svg>
            <div className="bracket-tree-columns">
                {rounds.map((round, roundIndex) => (
                    <div key={roundIndex} className="bracket-round-col">
                        <h4 className="bracket-round-title">{round.title}</h4>
                        <div
                            className="bracket-round-matches"
                            style={{ gap: MATCH_GAP, minHeight: baseCount * (SLOT_HEIGHT * 2 + MATCH_GAP) }}
                        >
                            {round.matches.map((match, matchIndex) => {
                                const a = match.players[0];
                                const b = match.players[1];
                                const winnerId = match.winnerId;
                                const clickable = a !== 'BYE' && b !== 'BYE' && a && b;
                                const cycleWinner = (current: string | null) => {
                                    if (!clickable) return;
                                    if (current === a) onSetWinner(roundIndex, matchIndex, b);
                                    else if (current === b) onSetWinner(roundIndex, matchIndex, null);
                                    else onSetWinner(roundIndex, matchIndex, a as string);
                                };
                                return (
                                    <div
                                        key={match.id}
                                        className="bracket-match-cell"
                                        data-match-key={`${keyPrefix}${roundIndex}-${matchIndex}`}
                                    >
                                        <div className="bracket-match-with-arrow">
                                            <div className="bracket-match">
                                                <div
                                                    className={`bracket-player ${winnerId === a ? 'winner' : ''} ${clickable ? 'clickable' : ''}`}
                                                    onClick={() => clickable && cycleWinner(winnerId)}
                                                >
                                                    {a === 'BYE' ? '부전승' : getPlayerName(a)}
                                                </div>
                                                <div
                                                    className={`bracket-player ${winnerId === b ? 'winner' : ''} ${clickable ? 'clickable' : ''}`}
                                                    onClick={() => clickable && (winnerId === b ? onSetWinner(roundIndex, matchIndex, null) : onSetWinner(roundIndex, matchIndex, b as string))}
                                                >
                                                    {b === 'BYE' ? '' : getPlayerName(b)}
                                                </div>
                                            </div>
                                            {roundIndex < rounds.length - 1 && (
                                                <div className="bracket-arrow-box" aria-hidden>
                                                    <span className="bracket-diagonal-arrow">{matchIndex % 2 === 0 ? '↘' : '↗'}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
