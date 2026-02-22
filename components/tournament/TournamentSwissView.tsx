
import React, { useState } from 'react';
import type { SwissData, SwissMatch, TournamentData, SwissPlayer } from '../../types';
import { sortSwissPlayers } from '../../utils';

interface TournamentSwissViewProps {
    swissData?: SwissData;
    onStartSwiss: (mode: 'random' | 'ranked') => void;
    onSetWinner: (roundIndex: number, matchId: string, winnerId: string | null) => void;
    onGenerateNextRound: () => void;
    onCancelLastRound: () => void;
    onRematchRound: () => void;
    onOpenPrizeModal: () => void;
    onPlayerSwap: React.Dispatch<React.SetStateAction<TournamentData>>;
    onOpenPlayerManagement: () => void;
}

const MATCHES_PER_TAB = 8; // 8 matches = 16 players per tab

export const TournamentSwissView = (props: TournamentSwissViewProps) => {
    const { swissData, onStartSwiss, onSetWinner, onGenerateNextRound, onCancelLastRound, onRematchRound, onOpenPrizeModal, onPlayerSwap, onOpenPlayerManagement } = props;

    const [draggedItem, setDraggedItem] = useState<{ matchId: string, playerId: string, playerIndex: 0 | 1 } | null>(null);
    const [roundTab, setRoundTab] = useState(0);

    if (!swissData || swissData.status === 'not_started' || swissData.rounds.length === 0) {
        return (
            <div className="tournament-swiss-view" style={{ textAlign: 'center', padding: '3rem' }}>
                <div style={{marginBottom: '1.5rem'}}>
                    <button className="btn" onClick={onOpenPlayerManagement}>선수 관리</button>
                </div>
                <p style={{ marginBottom: '1rem' }}>스위스 리그 대진표가 없습니다. '선수 관리'에서 참가자를 선택하고 리그를 시작하세요.</p>
            </div>
        );
    }
    
    const { players, rounds } = swissData;
    const sortedPlayers = sortSwissPlayers(players, rounds);
    const latestRoundIndex = rounds.length - 1;
    const latestRound = rounds[latestRoundIndex];
    const isRoundComplete = latestRound.every(match => match.winnerId !== null);

    const useRoundTabs = players.length >= 16 && rounds.length >= 1;
    const displayRounds = useRoundTabs
        ? [rounds[Math.min(roundTab, rounds.length - 1)]]
        : rounds;
    const displayRoundIndices = useRoundTabs
        ? [Math.min(roundTab, rounds.length - 1)]
        : rounds.map((_, i) => i);

    const getPlayerName = (playerId: string | 'BYE') => {
        if (playerId === 'BYE') return '부전승';
        return players.find(p => p.studentId === playerId)?.name || 'Unknown';
    };

    const handlePlayerClick = (match: SwissMatch, roundIndex: number, playerId: string) => {
        const newWinnerId = match.winnerId === playerId ? null : playerId;
        onSetWinner(roundIndex, match.id, newWinnerId);
    };

    const hasPlayedBefore = (p1Id: string | 'BYE', p2Id: string | 'BYE', currentRoundIndex: number) => {
        if (p1Id === 'BYE' || p2Id === 'BYE') return false;
        
        for (let i = 0; i < currentRoundIndex; i++) {
            const roundMatches = rounds[i];
            const played = roundMatches.some(m => 
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
        if (!draggedItem || targetMatch.winnerId || (draggedItem.playerId === targetPlayerId)) {
            setDraggedItem(null);
            return;
        }

        onPlayerSwap(prev => {
            const newData = JSON.parse(JSON.stringify(prev));
            if (!newData.swiss) return newData;
    
            const latestRoundIndex = newData.swiss.rounds.length - 1;
            const round = newData.swiss.rounds[latestRoundIndex];
            
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
                 <button className="btn" onClick={onOpenPlayerManagement}>선수 관리</button>
                 {isRoundComplete ? (
                    <button className="btn primary" onClick={onGenerateNextRound}>
                        다음 라운드 생성
                    </button>
                 ) : (
                    <button className="btn" onClick={onRematchRound} style={{border: '1px solid var(--primary-color)', color: 'var(--primary-color)'}}>
                        🔄 대진 다시 섞기
                    </button>
                 )}
                 {rounds.length > 0 && (
                    <button className="btn danger" onClick={onCancelLastRound}>
                        마지막 라운드 취소
                    </button>
                 )}
                 <button className="btn" onClick={onOpenPrizeModal} disabled={rounds.length === 0}>
                    결과 및 시상
                 </button>
            </div>
            {useRoundTabs && (
                <div className="group-tab-buttons" style={{ marginBottom: '1rem' }}>
                    {rounds.map((_, i) => (
                        <button
                            key={i}
                            className={`tab-btn ${roundTab === i ? 'active' : ''}`}
                            onClick={() => setRoundTab(i)}
                        >{i + 1}라운드</button>
                    ))}
                </div>
            )}
            <div className="swiss-layout">
                <div className="swiss-rounds-container">
                    {displayRounds.map((round, idx) => {
                        const roundIndex = displayRoundIndices[idx];
                        return (
                        <div key={roundIndex} className="swiss-round">
                            <h3 style={{ borderBottom: '2px solid #eee', paddingBottom: '0.5rem', marginBottom: '1rem' }}>{roundIndex + 1}라운드</h3>
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
                                            const isDraggable = roundIndex === latestRoundIndex && !match.winnerId && playerId !== 'BYE';
                                            const isClickable = playerId !== 'BYE';
                                            
                                            const playerElement = (
                                                 <div 
                                                    key={playerId}
                                                    className={`swiss-player ${!isClickable ? '' : 'clickable'} ${match.winnerId === playerId ? 'winner' : ''} ${match.winnerId && match.winnerId !== playerId ? 'loser' : ''} ${isDraggable ? 'draggable' : ''}`}
                                                    onClick={() => isClickable && typeof playerId === 'string' && handlePlayerClick(match, roundIndex, playerId)}
                                                    draggable={isDraggable}
                                                    onDragStart={e => isDraggable && typeof playerId === 'string' && handleDragStart(e, match, playerId, pIndex)}
                                                    onDragOver={handleDragOver}
                                                    onDragLeave={handleDragLeave}
                                                    onDrop={e => isDraggable && typeof playerId === 'string' && handleDrop(e, match, playerId, pIndex)}
                                                    onDragEnd={handleDragEnd}
                                                >
                                                    <span>{getPlayerName(playerId)}</span>
                                                    {match.winnerId === playerId && <span className="winner-label">승</span>}
                                                </div>
                                            );

                                            return playerKey === 'player1' ? playerElement : (
                                                <React.Fragment key={playerId}>
                                                    <div className="swiss-vs">VS</div>
                                                    {playerElement}
                                                </React.Fragment>
                                            )
                                        })}
                                    </li>
                                )})}
                            </ul>
                        </div>
                    );})}
                </div>
                <div className="swiss-standings-container">
                    <h3 style={{marginBottom: '1rem', color: 'var(--secondary-color)'}}>실시간 순위</h3>
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
                                        <td style={{fontWeight: 'bold'}}>{player.name}</td>
                                        <td>{player.score}</td>
                                        <td style={{color: '#666'}}>{player.sos}</td>
                                        <td style={{color: '#999'}}>{player.sosos}</td>
                                    </tr>
                                )})}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};