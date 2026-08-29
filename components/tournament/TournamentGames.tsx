
import React, { useState, useEffect } from 'react';
import type { TournamentData, TournamentSettings, TournamentPlayer, GameKey, GameSelection } from '../../types';
import { parseRank } from '../../utils';

interface TournamentGamesProps {
    data: TournamentData;
    settings: TournamentSettings;
    onPlayerChange: (teamName: 'A' | 'B', playerIndex: number, field: keyof TournamentPlayer, value: any) => void;
    onReorderMatchups: (dragIndex: number, hoverIndex: number) => void;
    onUniversalPlayerSwap: (
        dragged: { teamName: 'A' | 'B'; playerIndex: number },
        droppedOn: { teamName: 'A' | 'B'; playerIndex: number }
    ) => void;
    onOpenSwapModal: (teamName: 'A' | 'B', playerIndex: number) => void;
    /** 경기 탭 순서 변경 (fromIndex, toIndex는 settings.games 기준 0-based) */
    onReorderGames?: (fromIndex: number, toIndex: number) => void;
}

const gameNameMap: Record<GameKey, string> = {
    game1: '바둑',
    game2: '주사위 바둑',
    game3: '컬링',
};

const RelayPlayerCard = ({
    player,
    opponent,
    teamName,
    index,
    gameType,
    settings,
    onPlayerChange,
    onOpenSwapModal,
    onSelectSwap,
    swapSelected,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd
}: {
    player?: TournamentPlayer;
    opponent?: TournamentPlayer;
    teamName: 'A' | 'B';
    index: number;
    gameType: GameSelection;
    settings: TournamentSettings;
    onPlayerChange: TournamentGamesProps['onPlayerChange'];
    onOpenSwapModal: TournamentGamesProps['onOpenSwapModal'];
    onSelectSwap: (teamName: 'A' | 'B', index: number) => void;
    swapSelected: boolean;
    onDragStart: (e: React.DragEvent, teamName: 'A' | 'B', index: number) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent, teamName: 'A' | 'B', index: number) => void;
    onDragEnd: (e: React.DragEvent) => void;
}) => {
    
    const isEmpty = !player;
    const playerRank = player ? parseRank(player.rank) : 0;
    const opponentRank = opponent ? parseRank(opponent.rank) : 0;
    const ranksAreSame = !player || !opponent || playerRank === opponentRank;

    let handicapValue = 0;
    let isReadOnly = false;

    if (gameType === 'game1' && player) {
        if (ranksAreSame) {
            if (player.game1Color === 'white') {
                handicapValue = settings.game1SameRankHandicap;
                isReadOnly = true;
            } else {
                handicapValue = player.game1Handicap;
                isReadOnly = false;
            }
        } else {
            isReadOnly = true;
            if (player.game1Color === 'white') {
                handicapValue = 0;
            } else {
                const rankDiff = opponentRank - playerRank;
                handicapValue = rankDiff > 1 ? rankDiff * settings.game1RankDiffHandicap : 0;
            }
        }
    }

    const handleChange = (field: keyof TournamentPlayer, value: any) => {
        onPlayerChange(teamName, index, field, value);
    };

    const handleNumericChange = (field: keyof TournamentPlayer, valueStr: string) => {
        if (valueStr.trim() === '' || valueStr === '-') {
            handleChange(field, field === 'game1Handicap' ? 0 : null);
        } else {
            const num = parseFloat(valueStr);
            if (!isNaN(num)) handleChange(field, num);
        }
    };

    if (isEmpty) {
        return (
            <div 
                className="relay-card empty"
                onDragOver={onDragOver}
                onDrop={(e) => onDrop(e, teamName, index)}
            >
                Empty Slot
            </div>
        );
    }

    return (
        <div 
            className={`relay-card team-${teamName.toLowerCase()} ${swapSelected ? 'swap-selected' : ''}`}
            draggable
            onDragStart={(e) => onDragStart(e, teamName, index)}
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, teamName, index)}
            onDragEnd={onDragEnd}
        >
            <div className="relay-card-header">
                <div className="player-identity">
                    <span className="player-rank">{player.rank}</span>
                    <span className="player-name">{player.name}</span>
                </div>
                {gameType === 'game1' && (
                    <div className={`stone-indicator ${player.game1Color}`} title={player.game1Color === 'black' ? '흑' : '백'}>
                        {player.game1Color === 'black' ? '⚫' : '⚪'}
                    </div>
                )}
                <div className="relay-swap-actions">
                    <button type="button" className="btn-xs swap-btn" onClick={() => onSelectSwap(teamName, index)} title="다른 배정 선수와 맞교환">⇄</button>
                    <button type="button" className="btn-xs swap-btn" onClick={() => onOpenSwapModal(teamName, index)} title="대기 선수로 교체">🔄</button>
                </div>
            </div>

            <div className="relay-card-body">
                {gameType === 'game1' && (
                    <>
                        <div className="relay-input-row">
                            <label>흑/백</label>
                            <select 
                                value={player.game1Color} 
                                onChange={e => handleChange('game1Color', e.target.value)} 
                                className="sm-select"
                            >
                                <option value="black">흑</option>
                                <option value="white">백</option>
                            </select>
                        </div>
                        <div className="relay-input-row">
                            <label>덤</label>
                            <input 
                                type="number" 
                                className="sm-input"
                                step="0.5" 
                                value={isReadOnly ? handicapValue : player.game1Handicap} 
                                onChange={e => handleNumericChange('game1Handicap', e.target.value)} 
                                readOnly={isReadOnly} 
                            />
                        </div>
                        <div className="relay-input-row result-row">
                            <label>결과(집)</label>
                            <input 
                                type="number" 
                                className="sm-input highlight"
                                step="0.5" 
                                value={player.game1Result ?? ''} 
                                onChange={e => handleNumericChange('game1Result', e.target.value)} 
                                placeholder="-"
                            />
                        </div>
                    </>
                )}
                {gameType === 'game2' && (
                    <>
                        <div className="relay-input-row">
                            <label>따낸 돌</label>
                            <input 
                                type="number" 
                                className="sm-input"
                                value={player.game2Score ?? ''} 
                                onChange={e => handleNumericChange('game2Score', e.target.value)} 
                            />
                        </div>
                        <div className="relay-checkbox-row">
                            <input 
                                type="checkbox" 
                                id={`last-${teamName}-${index}`}
                                checked={player.game2LastStone} 
                                onChange={e => handleChange('game2LastStone', e.target.checked)} 
                            />
                            <label htmlFor={`last-${teamName}-${index}`}>마지막 돌</label>
                        </div>
                    </>
                )}
                {gameType === 'game3' && (
                    <div className="relay-input-row">
                        <label>성공</label>
                        <input 
                            type="number" 
                            className="sm-input"
                            value={player.game3Score ?? ''} 
                            onChange={e => handleNumericChange('game3Score', e.target.value)} 
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

const gameDisplayName: Record<GameSelection, string> = {
    game1: '바둑',
    game2: '주사위 바둑',
    game3: '컬링',
    none: '없음',
};

export const TournamentGames = (props: TournamentGamesProps) => {
    const { data, settings, onPlayerChange, onOpenSwapModal, onUniversalPlayerSwap, onReorderGames } = props;
    
    const [activeTab, setActiveTab] = useState(1);
    const [draggedItem, setDraggedItem] = useState<{ teamName: 'A' | 'B', index: number } | null>(null);
    const [draggedTabIndex, setDraggedTabIndex] = useState<number | null>(null);
    const [dragOverTabIndex, setDragOverTabIndex] = useState<number | null>(null);
    const [selectedSwap, setSelectedSwap] = useState<{ teamName: 'A' | 'B'; index: number } | null>(null);
    
    const configuredGames = settings.games
        .map((type, index) => ({ type, matchNumber: index + 1 }))
        .filter(g => g.type !== 'none');
    const allGameTabs = settings.games.map((type, index) => ({ type, index, matchNumber: index + 1 }));

    useEffect(() => {
        const activeGameStillExists = configuredGames.some(g => g.matchNumber === activeTab);
        if (!activeGameStillExists && configuredGames.length > 0) {
            setActiveTab(configuredGames[0].matchNumber);
        } else if (configuredGames.length === 0) {
            setActiveTab(1);
        }
    }, [settings.games, activeTab]);
    
    const gameTypeForActiveTab = settings.games[activeTab - 1] || 'none';
    const teamA = data.teams.find(t => t.name === 'A');
    const teamB = data.teams.find(t => t.name === 'B');
    const maxPlayers = Math.max(teamA?.players.length || 0, teamB?.players.length || 0);

    const handleDragStart = (e: React.DragEvent, teamName: 'A' | 'B', index: number) => {
        setDraggedItem({ teamName, index });
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => {
            (e.target as HTMLElement).classList.add('dragging');
        }, 0);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.currentTarget.classList.add('drag-over-indicator');
    };

    const handleDragEnd = (e: React.DragEvent) => {
        (e.target as HTMLElement).classList.remove('dragging');
        document.querySelectorAll('.drag-over-indicator').forEach(el => {
            el.classList.remove('drag-over-indicator');
        });
        setDraggedItem(null);
    };

    const handleDrop = (e: React.DragEvent, targetTeamName: 'A' | 'B', targetIndex: number) => {
        e.preventDefault();
        (e.currentTarget as HTMLElement).classList.remove('drag-over-indicator');

        if (!draggedItem) return;
        
        if (draggedItem.teamName === targetTeamName && draggedItem.index === targetIndex) {
            return;
        }

        onUniversalPlayerSwap(
            { teamName: draggedItem.teamName, playerIndex: draggedItem.index },
            { teamName: targetTeamName, playerIndex: targetIndex }
        );
        setDraggedItem(null);
    };

    const handleTapSwap = (teamName: 'A' | 'B', index: number) => {
        if (!selectedSwap) {
            setSelectedSwap({ teamName, index });
            return;
        }
        if (selectedSwap.teamName !== teamName || selectedSwap.index !== index) {
            onUniversalPlayerSwap(
                { teamName: selectedSwap.teamName, playerIndex: selectedSwap.index },
                { teamName, playerIndex: index }
            );
        }
        setSelectedSwap(null);
    };

    const handleTabDragStart = (e: React.DragEvent, index: number) => {
        if (!onReorderGames) return;
        setDraggedTabIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(index));
        (e.target as HTMLElement).classList.add('tab-dragging');
    };
    const handleTabDragEnd = (e: React.DragEvent) => {
        setDraggedTabIndex(null);
        setDragOverTabIndex(null);
        (e.target as HTMLElement).classList.remove('tab-dragging');
    };
    const handleTabDragOver = (e: React.DragEvent, index: number) => {
        if (!onReorderGames || draggedTabIndex === null) return;
        e.preventDefault();
        setDragOverTabIndex(index);
    };
    const handleTabDragLeave = () => setDragOverTabIndex(null);
    const handleTabDrop = (e: React.DragEvent, toIndex: number) => {
        e.preventDefault();
        if (!onReorderGames || draggedTabIndex === null) return;
        if (draggedTabIndex !== toIndex) {
            onReorderGames(draggedTabIndex, toIndex);
        }
        setDraggedTabIndex(null);
        setDragOverTabIndex(null);
    };

    return (
        <div className="tournament-games-container">
            <div className="tournament-games-header">
                <div className="tournament-tabs">
                    {allGameTabs.map((game) => (
                        <div
                            key={game.index}
                            className={`tab-btn-wrapper ${draggedTabIndex === game.index ? 'tab-dragging' : ''} ${dragOverTabIndex === game.index ? 'tab-drag-over' : ''}`}
                            draggable={!!onReorderGames}
                            onDragStart={(e) => handleTabDragStart(e, game.index)}
                            onDragEnd={handleTabDragEnd}
                            onDragOver={(e) => handleTabDragOver(e, game.index)}
                            onDragLeave={handleTabDragLeave}
                            onDrop={(e) => handleTabDrop(e, game.index)}
                        >
                            <button
                                type="button"
                                className={`tab-btn ${activeTab === game.matchNumber ? 'active' : ''}`}
                                onClick={() => setActiveTab(game.matchNumber)}
                            >
                                {game.matchNumber}경기 ({gameDisplayName[game.type]})
                            </button>
                        </div>
                    ))}
                </div>
                <p className="operation-inline-status relay-swap-hint">
                    {selectedSwap
                        ? `${selectedSwap.teamName}팀 ${selectedSwap.index + 1}번 선수 선택됨 — 맞바꿀 선수의 ⇄ 버튼을 누르세요.`
                        : '터치 기기에서는 선수 카드의 ⇄ 버튼을 차례로 눌러 배치를 맞바꿀 수 있습니다.'}
                </p>
            </div>

            {maxPlayers === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <p>참가 선수가 없습니다. '선수 관리 및 팀 배정' 버튼을 눌러 팀을 구성해주세요.</p>
                </div>
            ) : gameTypeForActiveTab === 'none' ? (
                 <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <p>표시할 경기가 없습니다. 대회 설정에서 경기를 구성해주세요.</p>
                </div>
            ) : (
                <div className="relay-board-container">
                    <div className="relay-grid" style={{ gridTemplateColumns: `repeat(${maxPlayers}, minmax(200px, 1fr))` }}>
                        {/* Blue Team Row (Top) */}
                        {Array.from({ length: maxPlayers }).map((_, i) => (
                            <div key={`a-${i}`} className="relay-cell top">
                                <div className="match-label">Match {i + 1}</div>
                                <RelayPlayerCard 
                                    player={teamA?.players[i]} 
                                    opponent={teamB?.players[i]}
                                    teamName="A" 
                                    index={i} 
                                    gameType={gameTypeForActiveTab} 
                                    settings={settings}
                                    onPlayerChange={onPlayerChange}
                                    onOpenSwapModal={onOpenSwapModal}
                                    onSelectSwap={handleTapSwap}
                                    swapSelected={selectedSwap?.teamName === 'A' && selectedSwap.index === i}
                                    onDragStart={handleDragStart}
                                    onDragOver={handleDragOver}
                                    onDrop={handleDrop}
                                    onDragEnd={handleDragEnd}
                                />
                            </div>
                        ))}

                        {/* VS Connector Row */}
                        {Array.from({ length: maxPlayers }).map((_, i) => (
                            <div key={`vs-${i}`} className="relay-vs-connector">
                                <div className="vs-line"></div>
                                <div className="vs-badge">VS</div>
                                <div className="vs-line"></div>
                            </div>
                        ))}

                        {/* Red Team Row (Bottom) */}
                        {Array.from({ length: maxPlayers }).map((_, i) => (
                            <div key={`b-${i}`} className="relay-cell bottom">
                                <RelayPlayerCard 
                                    player={teamB?.players[i]} 
                                    opponent={teamA?.players[i]}
                                    teamName="B" 
                                    index={i} 
                                    gameType={gameTypeForActiveTab} 
                                    settings={settings}
                                    onPlayerChange={onPlayerChange}
                                    onOpenSwapModal={onOpenSwapModal}
                                    onSelectSwap={handleTapSwap}
                                    swapSelected={selectedSwap?.teamName === 'B' && selectedSwap.index === i}
                                    onDragStart={handleDragStart}
                                    onDragOver={handleDragOver}
                                    onDrop={handleDrop}
                                    onDragEnd={handleDragEnd}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};