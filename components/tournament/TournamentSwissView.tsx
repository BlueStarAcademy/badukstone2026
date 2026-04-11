
import React, { useState, useEffect } from 'react';
import type { SwissData, SwissMatch, TournamentData, SwissPlayer } from '../../types';
import { sortSwissPlayers } from '../../utils';
import { SwissGroupPlayerSwapModal } from './SwissGroupPlayerSwapModal';

interface TournamentSwissViewProps {
    swissData?: SwissData;
    canResetSwiss: boolean;
    onResetSwiss: () => void;
    onSetWinner: (groupIndex: number | undefined, roundIndex: number, matchId: string, winnerId: string | null) => void;
    onGenerateNextRound: (groupIndex?: number) => void;
    onCancelLastRound: (groupIndex?: number) => void;
    onRematchRound: (groupIndex?: number) => void;
    onOpenPrizeModal: () => void;
    onPlayerSwap: React.Dispatch<React.SetStateAction<TournamentData>>;
    onOpenPlayerManagement: () => void;
    /** 조별 스위스: 서로 다른 조 선수 맞교환 */
    onSwapGroupPlayers?: (groupIndexA: number, studentIdA: string, groupIndexB: number, studentIdB: string) => void;
}

export const TournamentSwissView = (props: TournamentSwissViewProps) => {
    const {
        swissData,
        canResetSwiss,
        onResetSwiss,
        onSetWinner,
        onGenerateNextRound,
        onCancelLastRound,
        onRematchRound,
        onOpenPrizeModal,
        onPlayerSwap,
        onOpenPlayerManagement,
        onSwapGroupPlayers,
    } = props;

    const [swapModalOpen, setSwapModalOpen] = useState(false);
    const [draggedItem, setDraggedItem] = useState<{ matchId: string; playerId: string; playerIndex: 0 | 1 } | null>(null);
    const [roundTab, setRoundTab] = useState(0);
    const [swissGroupTab, setSwissGroupTab] = useState(0);

    const useGroups = !!(swissData?.groups && swissData.groups.length > 0);
    const groupIndexForCallbacks: number | undefined = useGroups ? swissGroupTab : undefined;

    useEffect(() => {
        if (useGroups && swissData?.groups && swissGroupTab >= swissData.groups.length) {
            setSwissGroupTab(0);
        }
    }, [useGroups, swissData?.groups, swissGroupTab]);

    const swissStarted =
        swissData &&
        swissData.status !== 'not_started' &&
        (useGroups ? swissData.groups!.some(g => g.rounds.length > 0) : swissData.rounds.length > 0);

    const canShowGroupSwap = !!(
        onSwapGroupPlayers &&
        useGroups &&
        swissData?.groups &&
        swissData.groups.length >= 2
    );

    if (!swissStarted) {
        return (
            <>
                {canShowGroupSwap && (
                    <SwissGroupPlayerSwapModal
                        isOpen={swapModalOpen}
                        onClose={() => setSwapModalOpen(false)}
                        groups={swissData!.groups!}
                        onSwap={(gA, idA, gB, idB) => onSwapGroupPlayers!(gA, idA, gB, idB)}
                    />
                )}
                <div className="tournament-swiss-view" style={{ textAlign: 'center', padding: '3rem' }}>
                    <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button className="btn" onClick={onOpenPlayerManagement}>
                            선수 관리
                        </button>
                        {canShowGroupSwap && (
                            <button type="button" className="btn" onClick={() => setSwapModalOpen(true)}>
                                조 간 선수 교체
                            </button>
                        )}
                        <button type="button" className="btn danger" onClick={onResetSwiss} disabled={!canResetSwiss}>
                            스위스 리그 초기화
                        </button>
                    </div>
                    <p style={{ marginBottom: '1rem' }}>
                        스위스 리그 대진표가 없습니다. 대회 설정에서 조별 진행을 켠 경우 조 인원 합이 참가자 수와 같아야 합니다. '선수 관리'에서 참가자를 선택하고 리그를 시작하세요.
                    </p>
                </div>
            </>
        );
    }

    const players: SwissPlayer[] = useGroups
        ? swissData!.groups![swissGroupTab].players
        : swissData!.players;
    const rounds: SwissMatch[][] = useGroups ? swissData!.groups![swissGroupTab].rounds : swissData!.rounds;

    const sortedPlayers = sortSwissPlayers(players, rounds);
    const latestRoundIndex = rounds.length - 1;
    const latestRound = rounds[latestRoundIndex];
    const isRoundComplete = latestRound.every(match => match.winnerId !== null);

    const useRoundTabs = players.length >= 16 && rounds.length >= 1;
    const displayRounds = useRoundTabs ? [rounds[Math.min(roundTab, rounds.length - 1)]] : rounds;
    const displayRoundIndices = useRoundTabs
        ? [Math.min(roundTab, rounds.length - 1)]
        : rounds.map((_, i) => i);

    const getPlayerName = (playerId: string | 'BYE') => {
        if (playerId === 'BYE') return '부전승';
        return players.find(p => p.studentId === playerId)?.name || 'Unknown';
    };

    const handlePlayerClick = (match: SwissMatch, roundIndex: number, playerId: string) => {
        const newWinnerId = match.winnerId === playerId ? null : playerId;
        onSetWinner(groupIndexForCallbacks, roundIndex, match.id, newWinnerId);
    };

    const hasPlayedBefore = (p1Id: string | 'BYE', p2Id: string | 'BYE', currentRoundIndex: number) => {
        if (p1Id === 'BYE' || p2Id === 'BYE') return false;

        for (let i = 0; i < currentRoundIndex; i++) {
            const roundMatches = rounds[i];
            const played = roundMatches.some(
                m =>
                    (m.players[0] === p1Id && m.players[1] === p2Id) ||
                    (m.players[0] === p2Id && m.players[1] === p1Id)
            );
            if (played) return true;
        }
        return false;
    };

    const handleDragStart = (e: React.DragEvent, match: SwissMatch, playerId: string, playerIndex: 0 | 1) => {
        if (match.winnerId) {
            e.preventDefault();
            return;
        }
        setDraggedItem({ matchId: match.id, playerId, playerIndex });
        e.currentTarget.classList.add('dragging');
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        const target = e.currentTarget as HTMLDivElement;
        if (draggedItem && !target.classList.contains('dragging')) {
            target.classList.add('drag-over-indicator');
        }
    };

    const handleDragLeave = (e: React.DragEvent) => {
        (e.currentTarget as HTMLDivElement).classList.remove('drag-over-indicator');
    };

    const handleDrop = (e: React.DragEvent, targetMatch: SwissMatch, targetPlayerId: string, targetPlayerIndex: 0 | 1) => {
        e.preventDefault();
        (e.currentTarget as HTMLDivElement).classList.remove('drag-over-indicator');
        if (!draggedItem || targetMatch.winnerId || draggedItem.playerId === targetPlayerId) {
            setDraggedItem(null);
            return;
        }

        const gIdx = groupIndexForCallbacks;

        onPlayerSwap(prev => {
            const newData = JSON.parse(JSON.stringify(prev));
            if (!newData.swiss) return newData;

            let roundList: SwissMatch[][];
            if (gIdx !== undefined && newData.swiss.groups?.[gIdx]) {
                roundList = newData.swiss.groups[gIdx].rounds;
            } else {
                roundList = newData.swiss.rounds;
            }

            const latestIdx = roundList.length - 1;
            const round = roundList[latestIdx];

            const sourceMatch = round.find((m: SwissMatch) => m.id === draggedItem.matchId);
            const dropMatch = round.find((m: SwissMatch) => m.id === targetMatch.id);

            if (!sourceMatch || !dropMatch) return newData;

            const sourcePlayer = sourceMatch.players[draggedItem.playerIndex];
            const dropPlayer = dropMatch.players[targetPlayerIndex];

            sourceMatch.players[draggedItem.playerIndex] = dropPlayer;
            dropMatch.players[targetPlayerIndex] = sourcePlayer;

            return newData;
        });

        setDraggedItem(null);
    };

    const handleDragEnd = (e: React.DragEvent) => {
        (e.currentTarget as HTMLDivElement).classList.remove('dragging');
        document.querySelectorAll('.drag-over-indicator').forEach(el => el.classList.remove('drag-over-indicator'));
        setDraggedItem(null);
    };

    return (
        <div className="tournament-swiss-view">
            <div className="swiss-controls">
                <button className="btn" onClick={onOpenPlayerManagement}>
                    선수 관리
                </button>
                {isRoundComplete && (
                    <button className="btn primary" onClick={() => onGenerateNextRound(groupIndexForCallbacks)}>
                        다음 라운드 생성
                    </button>
                )}
                {rounds.length > 0 && (
                    <button className="btn danger" onClick={() => onCancelLastRound(groupIndexForCallbacks)}>
                        마지막 라운드 취소
                    </button>
                )}
                <button className="btn" onClick={onOpenPrizeModal} disabled={rounds.length === 0}>
                    결과 및 시상
                </button>
                <button type="button" className="btn danger" onClick={onResetSwiss} disabled={!canResetSwiss}>
                    스위스 리그 초기화
                </button>
                {canShowGroupSwap && (
                    <button type="button" className="btn" onClick={() => setSwapModalOpen(true)}>
                        조 간 선수 교체
                    </button>
                )}
            </div>
            {canShowGroupSwap && (
                <SwissGroupPlayerSwapModal
                    isOpen={swapModalOpen}
                    onClose={() => setSwapModalOpen(false)}
                    groups={swissData!.groups!}
                    onSwap={(gA, idA, gB, idB) => onSwapGroupPlayers!(gA, idA, gB, idB)}
                />
            )}
            {useGroups && swissData!.groups!.length > 0 && (
                <div className="group-tab-buttons" style={{ marginBottom: '1rem' }}>
                    {swissData!.groups!.map((g, i) => (
                        <button
                            key={g.id}
                            className={`tab-btn ${swissGroupTab === i ? 'active' : ''}`}
                            onClick={() => {
                                setSwissGroupTab(i);
                                setRoundTab(0);
                            }}
                        >
                            {g.label}
                        </button>
                    ))}
                </div>
            )}
            {useRoundTabs && (
                <div className="group-tab-buttons" style={{ marginBottom: '1rem' }}>
                    {rounds.map((_, i) => (
                        <button
                            key={i}
                            className={`tab-btn ${roundTab === i ? 'active' : ''}`}
                            onClick={() => setRoundTab(i)}
                        >
                            {i + 1}라운드
                        </button>
                    ))}
                </div>
            )}
            <div className="swiss-layout">
                <div className="swiss-rounds-container">
                    {displayRounds.map((round, idx) => {
                        const roundIndex = displayRoundIndices[idx];
                        const hasRematchInRound = round.some(m =>
                            hasPlayedBefore(m.players[0], m.players[1], roundIndex)
                        );
                        const isLatestRound = roundIndex === latestRoundIndex;
                        const showRematchBtn = isLatestRound && hasRematchInRound;
                        return (
                            <div key={roundIndex} className="swiss-round">
                                <div className="swiss-round-header">
                                    <h3 className="swiss-round-title">{roundIndex + 1}라운드</h3>
                                    {showRematchBtn && (
                                        <button
                                            type="button"
                                            className="btn swiss-round-rematch-btn"
                                            onClick={() => onRematchRound(groupIndexForCallbacks)}
                                            title="이 라운드 대진 다시 섞기"
                                        >
                                            🔄 대진 다시 섞기
                                        </button>
                                    )}
                                </div>
                                <ul className="swiss-match-list">
                                    {round.map(match => {
                                        const isDuplicate = hasPlayedBefore(match.players[0], match.players[1], roundIndex);

                                        return (
                                            <li key={match.id} className="swiss-match" style={{ position: 'relative' }}>
                                                {isDuplicate && (
                                                    <div className="match-warning" title="이전에 대국한 적이 있는 매칭입니다.">
                                                        ⚠️ 재매칭
                                                    </div>
                                                )}
                                                {(['player1', 'player2'] as const).map((playerKey, playerIndex) => {
                                                    const pIndex = playerIndex as 0 | 1;
                                                    const playerId = match.players[pIndex];
                                                    const isDraggable =
                                                        roundIndex === latestRoundIndex && !match.winnerId && playerId !== 'BYE';
                                                    const isClickable = playerId !== 'BYE';

                                                    const playerElement = (
                                                        <div
                                                            key={String(playerId) + pIndex}
                                                            className={`swiss-player ${!isClickable ? '' : 'clickable'} ${match.winnerId === playerId ? 'winner' : ''} ${match.winnerId && match.winnerId !== playerId ? 'loser' : ''} ${isDraggable ? 'draggable' : ''}`}
                                                            onClick={() =>
                                                                isClickable &&
                                                                typeof playerId === 'string' &&
                                                                handlePlayerClick(match, roundIndex, playerId)
                                                            }
                                                            draggable={isDraggable}
                                                            onDragStart={e =>
                                                                isDraggable &&
                                                                typeof playerId === 'string' &&
                                                                handleDragStart(e, match, playerId, pIndex)
                                                            }
                                                            onDragOver={handleDragOver}
                                                            onDragLeave={handleDragLeave}
                                                            onDrop={e =>
                                                                isDraggable &&
                                                                typeof playerId === 'string' &&
                                                                handleDrop(e, match, playerId, pIndex)
                                                            }
                                                            onDragEnd={handleDragEnd}
                                                        >
                                                            <span>{getPlayerName(playerId)}</span>
                                                            {match.winnerId === playerId && <span className="winner-label">승</span>}
                                                        </div>
                                                    );

                                                    return playerKey === 'player1' ? (
                                                        playerElement
                                                    ) : (
                                                        <React.Fragment key={`vs-${match.id}-${pIndex}`}>
                                                            <div className="swiss-vs">VS</div>
                                                            {playerElement}
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        );
                    })}
                </div>
                <div className="swiss-standings-container">
                    <h3 style={{ marginBottom: '1rem', color: 'var(--secondary-color)' }}>
                        실시간 순위{useGroups ? ` (${swissData!.groups![swissGroupTab].label})` : ''}
                    </h3>
                    <div className="swiss-table-wrapper">
                        <table className="swiss-standings-table">
                            <thead>
                                <tr>
                                    <th>순위</th>
                                    <th>이름</th>
                                    <th>승점</th>
                                    <th>SOS</th>
                                    <th>SOSOS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedPlayers.map((player, index) => {
                                    let rankClass = '';
                                    if (index === 0) rankClass = 'rank-1';
                                    else if (index === 1) rankClass = 'rank-2';
                                    else if (index === 2) rankClass = 'rank-3';

                                    return (
                                        <tr key={player.studentId} className={rankClass}>
                                            <td>
                                                {index === 0 && '🥇'}
                                                {index === 1 && '🥈'}
                                                {index === 2 && '🥉'}
                                                {index > 2 && index + 1}
                                            </td>
                                            <td style={{ fontWeight: 'bold' }}>{player.name}</td>
                                            <td>{player.score}</td>
                                            <td style={{ color: '#666' }}>{player.sos}</td>
                                            <td style={{ color: '#999' }}>{player.sosos}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};
