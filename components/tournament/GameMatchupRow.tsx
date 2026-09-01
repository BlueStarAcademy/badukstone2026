import React from 'react';
// FIX: Corrected import path for type definitions.
import type { TournamentPlayer, TournamentSettings, GameSelection } from '../../types';
import { getEffectiveGame1Handicap } from '../../utils/tournament/relayScoring';
import { parseRank } from '../../utils';

interface GameMatchupRowProps {
    matchIndex: number;
    playerA?: TournamentPlayer;
    playerB?: TournamentPlayer;
    gameType: GameSelection;
    settings: TournamentSettings;
    onPlayerChange: (teamName: 'A' | 'B', playerIndex: number, field: keyof TournamentPlayer, value: any) => void;
    dragHandle: React.ReactNode;
    onPlayerDragStart: (e: React.DragEvent<HTMLDivElement>, team: 'A' | 'B', index: number) => void;
    onPlayerDrop: (e: React.DragEvent<HTMLDivElement>, team: 'A' | 'B', index: number) => void;
    onPlayerDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
    onPlayerDragEnter: (e: React.DragEvent<HTMLDivElement>) => void;
    onPlayerDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
    onPlayerDragEnd: (e: React.DragEvent<HTMLDivElement>) => void;
    onOpenSwapModal: (teamName: 'A' | 'B', playerIndex: number) => void;
}

const PlayerColumn: React.FC<{
    player?: TournamentPlayer;
    opponent?: TournamentPlayer;
    teamName: 'A' | 'B';
    matchIndex: number;
    gameType: GameSelection;
    settings: TournamentSettings;
    onPlayerChange: GameMatchupRowProps['onPlayerChange'];
    onPlayerDragStart: GameMatchupRowProps['onPlayerDragStart'];
    onPlayerDrop: GameMatchupRowProps['onPlayerDrop'];
    onPlayerDragOver: GameMatchupRowProps['onPlayerDragOver'];
    onPlayerDragEnter: GameMatchupRowProps['onPlayerDragEnter'];
    onPlayerDragLeave: GameMatchupRowProps['onPlayerDragLeave'];
    onPlayerDragEnd: GameMatchupRowProps['onPlayerDragEnd'];
    onOpenSwapModal: GameMatchupRowProps['onOpenSwapModal'];
}> = ({ 
    player, opponent, teamName, matchIndex, gameType, settings, onPlayerChange,
    onPlayerDragStart, onPlayerDrop, onPlayerDragOver, onPlayerDragEnter, onPlayerDragLeave, onPlayerDragEnd,
    onOpenSwapModal
}) => {

    if (!player) {
        return <div className={`matchup-row-player-col team-${teamName.toLowerCase()}`}>-</div>;
    }

    const playerRank = parseRank(player.rank);
    const opponentRank = opponent ? parseRank(opponent.rank) : 0;
    const ranksAreSame = !opponent || playerRank === opponentRank;

    const handicapValue = getEffectiveGame1Handicap(player, opponent, settings);

    const handleChange = (field: keyof TournamentPlayer, value: any) => {
        onPlayerChange(teamName, matchIndex, field, value);
    };

    const handleNumericChange = (field: 'game1Result' | 'game2Score' | 'game3Score', valueStr: string) => {
        if (valueStr.trim() === '' || valueStr === '-') {
            handleChange(field, 0);
        } else {
            const num = parseFloat(valueStr);
            if (!isNaN(num)) {
                handleChange(field, num);
            }
        }
    };
    
    const handleHandicapChange = (valueStr: string) => {
        if (valueStr.trim() === '') {
            handleChange('game1Handicap', 0);
        } else {
            const num = parseFloat(valueStr);
            if (!isNaN(num)) {
                handleChange('game1Handicap', num);
            }
        }
    };

    const stopBackspace = (e: React.KeyboardEvent) => {
        if (e.key === 'Backspace') {
            e.stopPropagation();
        }
    };


    return (
        <div 
            className={`matchup-row-player-col team-${teamName.toLowerCase()}`}
            draggable={!!player}
            onDragStart={e => player && onPlayerDragStart(e, teamName, matchIndex)}
            onDrop={e => onPlayerDrop(e, teamName, matchIndex)}
            onDragOver={onPlayerDragOver}
            onDragEnter={onPlayerDragEnter}
            onDragLeave={onPlayerDragLeave}
            onDragEnd={onPlayerDragEnd}
        >
            <div className="player-info-header">
                <h4>{player.name}</h4>
                 <div className="player-header-actions">
                    <button className="btn-sm" onClick={() => onOpenSwapModal(teamName, matchIndex)} title="선수 교체">🔄</button>
                    <span>{player.rank}</span>
                </div>
            </div>
            <div className="player-info-inputs">
                {gameType === 'game1' && (
                    <>
                        <div className="form-group">
                            <label>덤</label>
                            <input type="number" step="0.5" value={handicapValue} onChange={e => handleHandicapChange(e.target.value)} draggable={false} onDragStart={e => e.stopPropagation()} onKeyDown={stopBackspace} placeholder="0" title="자동 계산값을 관리자가 수동으로 조정할 수 있습니다" />
                        </div>
                        <div className="form-group">
                            <label>흑/백</label>
                            <select value={player.game1Color} onChange={e => handleChange('game1Color', e.target.value)} disabled={!ranksAreSame} draggable={false} onDragStart={e => e.stopPropagation()} onKeyDown={stopBackspace}>
                                <option value="black">흑</option>
                                <option value="white">백</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>결과(집)</label>
                            <input type="number" step="0.5" value={player.game1Result ?? ''} onChange={e => handleNumericChange('game1Result', e.target.value)} draggable={false} onDragStart={e => e.stopPropagation()} onKeyDown={stopBackspace} placeholder="0" />
                        </div>
                    </>
                )}
                 {gameType === 'game2' && (
                    <>
                        <div className="form-group">
                            <label>잡은 돌</label>
                            <input type="number" value={player.game2Score ?? ''} onChange={e => handleNumericChange('game2Score', e.target.value)} draggable={false} onDragStart={e => e.stopPropagation()} onKeyDown={stopBackspace} placeholder="0" />
                        </div>
                        <div className="form-group-checkbox" style={{ justifyContent: 'center', alignItems: 'flex-end' }}>
                            <input type="checkbox" id={`last-stone-${teamName}-${matchIndex}`} checked={player.game2LastStone} onChange={e => handleChange('game2LastStone', e.target.checked)} draggable={false} onDragStart={e => e.stopPropagation()} onKeyDown={stopBackspace} />
                            <label htmlFor={`last-stone-${teamName}-${matchIndex}`}>마지막 돌</label>
                        </div>
                    </>
                )}
                {gameType === 'game3' && (
                    <div className="form-group">
                        <label>성공한 돌</label>
                        <input type="number" value={player.game3Score ?? ''} onChange={e => handleNumericChange('game3Score', e.target.value)} draggable={false} onDragStart={e => e.stopPropagation()} onKeyDown={stopBackspace} placeholder="0" />
                    </div>
                )}
            </div>
        </div>
    );
};

export const GameMatchupRow = (props: GameMatchupRowProps) => {
    const { 
        matchIndex, playerA, playerB, gameType, settings, onPlayerChange, dragHandle, 
        onPlayerDragStart, onPlayerDrop, onPlayerDragOver, onPlayerDragEnter, onPlayerDragLeave, onPlayerDragEnd,
        onOpenSwapModal
    } = props;
    
    const playerColumnProps = {
        gameType, settings, onPlayerChange,
        onPlayerDragStart, onPlayerDrop, onPlayerDragOver, onPlayerDragEnter, onPlayerDragLeave, onPlayerDragEnd,
        onOpenSwapModal
    };

    return (
        <div className="game-matchup-row">
            <div className="matchup-row-header">
                {dragHandle}
                <span>{matchIndex + 1}장</span>
            </div>
            <div className="matchup-row-body">
                <PlayerColumn {...playerColumnProps} player={playerA} opponent={playerB} teamName="A" matchIndex={matchIndex} />
                <div className="matchup-row-vs-col">VS</div>
                <PlayerColumn {...playerColumnProps} player={playerB} opponent={playerA} teamName="B" matchIndex={matchIndex} />
            </div>
        </div>
    );
};