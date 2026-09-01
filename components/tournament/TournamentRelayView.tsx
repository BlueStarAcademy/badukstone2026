
import React, { useState, useCallback } from 'react';
import type { Student, TournamentAwardRequest, TournamentData, TournamentSettings, TournamentPlayer } from '../../types';
import { TournamentGames } from './TournamentGames';
import { TournamentSummary } from './TournamentSummary';
import { PlayerSwapModal } from './PlayerSwapModal';
import { ConfirmationModal } from '../modals/ConfirmationModal';
import { RelayTeamContributionModal } from './RelayTeamContributionModal';
import { parseRank } from '../../utils';
import { cloneDeep } from '../../utils/tournament/clone';
import { syncAutoGame1Handicap } from '../../utils/tournament/relayScoring';

interface TournamentRelayViewProps {
    data: TournamentData;
    students: Student[];
    setData: React.Dispatch<React.SetStateAction<TournamentData>>;
    settings: TournamentSettings;
    setSettings: React.Dispatch<React.SetStateAction<TournamentSettings>>;
    onAwardBatch: (request: TournamentAwardRequest) => boolean;
    awardEventKey: string;
    isAwarded: (eventKey: string) => boolean;
    onOpenPlayerManagement: () => void;
    onAssignTeams?: (mode: 'random' | 'ranked', ids: string[]) => void;
}

export const TournamentRelayView: React.FC<TournamentRelayViewProps> = (props) => {
    const {
        data, students, setData, settings, setSettings, onAwardBatch, awardEventKey,
        isAwarded, onOpenPlayerManagement, onAssignTeams,
    } = props;
    
    const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
    const [playerToSwap, setPlayerToSwap] = useState<{ teamName: 'A' | 'B', playerIndex: number } | null>(null);
    const [confirmation, setConfirmation] = useState<{ message: React.ReactNode, actions: any[] } | null>(null);
    const [isContributionModalOpen, setIsContributionModalOpen] = useState(false);
    const [bonusEditorTeam, setBonusEditorTeam] = useState<'A' | 'B' | null>(null);
    const [bonusAmount, setBonusAmount] = useState('5');
    const [assignmentMode, setAssignmentMode] = useState<'random' | 'ranked'>('ranked');

    const participantIds = data.relayParticipantIds || [];
    const hasTeamPlayers = (data.teams || []).some(team => (team.players?.length || 0) > 0);
    const canResetRelayTeams =
        participantIds.length > 0 || hasTeamPlayers;

    const handleClearTeamsKeepRoster = () => {
        setData(prev => ({
            ...prev,
            teams: [
                { name: 'A', players: [], mannerPenalties: 0, bonusScore: 0 },
                { name: 'B', players: [], mannerPenalties: 0, bonusScore: 0 },
            ],
        }));
        setConfirmation(null);
    };
    const syncMatchupHandicaps = useCallback((
        teamsCopy: TournamentData['teams'],
        indices: number[]
    ) => {
        const teamA = teamsCopy.find(team => team.name === 'A');
        const teamB = teamsCopy.find(team => team.name === 'B');
        if (!teamA || !teamB) return;

        indices.forEach(index => {
            const playerA = teamA.players[index];
            const playerB = teamB.players[index];
            if (playerA && playerB) {
                teamA.players[index] = syncAutoGame1Handicap(playerA, playerB, settings);
                teamB.players[index] = syncAutoGame1Handicap(playerB, playerA, settings);
            }
        });
    }, [settings]);

    const handlePlayerChange = (teamName: 'A' | 'B', playerIndex: number, field: keyof TournamentPlayer, value: any) => {
        setData(prev => {
            const newTeams = prev.teams.map(team => {
                if (team.name === teamName) {
                    const newPlayers = [...team.players];
                    const current = newPlayers[playerIndex];
                    if (!current) return team;

                    if (field === 'game1Handicap') {
                        newPlayers[playerIndex] = {
                            ...current,
                            game1Handicap: value,
                            game1HandicapOverride: true,
                        };
                    } else {
                        newPlayers[playerIndex] = { ...current, [field]: value };
                    }
                    return { ...team, players: newPlayers };
                }
                return team;
            });

            if (field === 'game1Color') {
                syncMatchupHandicaps(newTeams, [playerIndex]);
            }

            return { ...prev, teams: newTeams };
        });
    };
    
    const handleReorderMatchups = (dragIndex: number, hoverIndex: number) => {
        setData(prev => {
            const reorderedA = [...prev.teams[0].players];
            const reorderedB = [...prev.teams[1].players];
            const [draggedA] = reorderedA.splice(dragIndex, 1);
            const [draggedB] = reorderedB.splice(dragIndex, 1);
            reorderedA.splice(hoverIndex, 0, draggedA);
            reorderedB.splice(hoverIndex, 0, draggedB);
            
            return {
                ...prev,
                teams: [{ ...prev.teams[0], players: reorderedA }, { ...prev.teams[1], players: reorderedB }]
            }
        });
    };

    const autoAssignColors = (playerA: TournamentPlayer, playerB: TournamentPlayer) => {
        if (!playerA || !playerB) return;
        
        const rankA = parseRank(playerA.rank);
        const rankB = parseRank(playerB.rank);

        if (rankA > rankB) {
            playerA.game1Color = 'white';
            playerB.game1Color = 'black';
        } else if (rankB > rankA) {
            playerB.game1Color = 'white';
            playerA.game1Color = 'black';
        }
    };

    const handleUniversalPlayerSwap = useCallback((
        dragged: { teamName: 'A' | 'B'; playerIndex: number },
        droppedOn: { teamName: 'A' | 'B'; playerIndex: number }
    ) => {
        setData(prev => {
            const teamsCopy = cloneDeep(prev.teams);
            const teamA = teamsCopy.find((t: { name: string }) => t.name === 'A');
            const teamB = teamsCopy.find((t: { name: string }) => t.name === 'B');

            if (!teamA || !teamB) return prev;

            const draggedPlayer = dragged.teamName === 'A' 
                ? teamA.players[dragged.playerIndex] 
                : teamB.players[dragged.playerIndex];

            const droppedOnPlayer = droppedOn.teamName === 'A'
                ? teamA.players[droppedOn.playerIndex]
                : teamB.players[droppedOn.playerIndex];
            
            if (dragged.teamName === 'A') teamA.players[dragged.playerIndex] = droppedOnPlayer;
            else teamB.players[dragged.playerIndex] = droppedOnPlayer;

            if (droppedOn.teamName === 'A') teamA.players[droppedOn.playerIndex] = draggedPlayer;
            else teamB.players[droppedOn.playerIndex] = draggedPlayer;

            const indicesToCheck = new Set([dragged.playerIndex, droppedOn.playerIndex]);
            
            indicesToCheck.forEach(index => {
                const pA = teamA.players[index];
                const pB = teamB.players[index];
                if (pA && pB) {
                    autoAssignColors(pA, pB);
                }
            });

            syncMatchupHandicaps(teamsCopy, [...indicesToCheck]);

            return { ...prev, teams: teamsCopy };
        });
    }, [setData, syncMatchupHandicaps]);

    const handleApplyPenalty = (teamName: 'A' | 'B') => {
        setConfirmation({
            message: `${teamName}팀에게 예절 불량으로 감점을 적용하시겠습니까? (-${settings.relayMannerPenalty || 0}점)`,
            actions: [
                { text: '취소', onClick: () => setConfirmation(null) },
                { 
                    text: '감점 적용', 
                    className: 'danger', 
                    onClick: () => {
                        setData(prev => {
                            const newTeams = prev.teams.map(team => {
                                if (team.name === teamName) {
                                    return { ...team, mannerPenalties: (team.mannerPenalties || 0) + 1 };
                                }
                                return team;
                            });
                            return { ...prev, teams: newTeams };
                        });
                        setConfirmation(null);
                    }
                }
            ]
        });
    };

    const handleApplyBonus = (teamName: 'A' | 'B') => {
        setBonusEditorTeam(teamName);
        setBonusAmount('5');
    };

    const applyBonus = () => {
        if (!bonusEditorTeam) return;
        const amount = Number.parseInt(bonusAmount, 10);
        if (!Number.isFinite(amount) || amount === 0) return;

        setData(prev => {
            const newTeams = prev.teams.map(team => {
                if (team.name === bonusEditorTeam) {
                    return { ...team, bonusScore: (team.bonusScore || 0) + amount };
                }
                return team;
            });
            return { ...prev, teams: newTeams };
        });
        setBonusEditorTeam(null);
    };

    const handleOpenSwapModal = (teamName: 'A' | 'B', playerIndex: number) => {
        setPlayerToSwap({ teamName, playerIndex });
        setIsSwapModalOpen(true);
    };

    const handleConfirmSwap = (newStudent: Student) => {
        if (!playerToSwap) return;
        const { teamName, playerIndex } = playerToSwap;
        
        setData(prev => {
            const teamsCopy = cloneDeep(prev.teams);
            const targetTeam = teamsCopy.find((t: any) => t.name === teamName);
            const otherTeam = teamsCopy.find((t: any) => t.name !== teamName);

            if (targetTeam) {
                targetTeam.players[playerIndex] = {
                    studentId: newStudent.id,
                    name: newStudent.name,
                    rank: newStudent.rank,
                    game1Handicap: 0,
                    game1HandicapOverride: false,
                    game1Color: 'black',
                    game1Result: null,
                    game2Score: null,
                    game2LastStone: false,
                    game3Score: null,
                };

                const pA = teamName === 'A' ? targetTeam.players[playerIndex] : otherTeam?.players[playerIndex];
                const pB = teamName === 'B' ? targetTeam.players[playerIndex] : otherTeam?.players[playerIndex];
                
                if (pA && pB) {
                    autoAssignColors(pA, pB);
                }
            }
            syncMatchupHandicaps(teamsCopy, [playerIndex]);
            return { ...prev, teams: teamsCopy };
        });
        setIsSwapModalOpen(false);
        setPlayerToSwap(null);
    };

    const availableStudents = students.filter(s =>
        !data.teams.some(team => team.players.some(p => p.studentId === s.id))
    );
    
    const playerToReplace = playerToSwap 
        ? data.teams.find(t => t.name === playerToSwap.teamName)?.players[playerToSwap.playerIndex]
        : null;

    if (!hasTeamPlayers) {
        return (
            <div className="tournament-relay-view tournament-empty-state">
                <span className="tournament-empty-kicker">RELAY SETUP</span>
                <h3>팀 대항전 준비</h3>
                <div className="tournament-empty-actions">
                    <button type="button" className="btn" onClick={onOpenPlayerManagement}>
                        선수 관리 및 팀 배정
                    </button>
                    <button
                        type="button"
                        className="btn danger"
                        disabled={!canResetRelayTeams}
                        onClick={() =>
                            setConfirmation({
                                message: '팀 배정을 지울까요? 참가자 목록은 유지됩니다.',
                                actions: [
                                    { text: '취소', onClick: () => setConfirmation(null) },
                                    { text: '초기화', className: 'danger', onClick: handleClearTeamsKeepRoster },
                                ],
                            })
                        }
                    >
                        팀 배정 초기화
                    </button>
                </div>
                <p>
                    팀 배정이 없습니다.
                    {participantIds.length >= 2
                        ? ' 저장된 참가자로 바로 팀을 배정할 수 있습니다.'
                        : " '선수 관리 및 팀 배정'에서 참가자를 선택하세요."}
                </p>
                {onAssignTeams && (
                    <>
                        <div className="tournament-empty-setup">
                            <div className="tournament-player-mgmt-assign">
                                <label htmlFor="relay-empty-assign">배정/시드</label>
                                <select
                                    id="relay-empty-assign"
                                    value={assignmentMode}
                                    onChange={e => setAssignmentMode(e.target.value as 'random' | 'ranked')}
                                >
                                    <option value="ranked">급수 순</option>
                                    <option value="random">무작위</option>
                                </select>
                            </div>
                        </div>
                        <div className="tournament-empty-actions">
                            <button
                                type="button"
                                className="btn primary"
                                onClick={() => onAssignTeams(assignmentMode, participantIds)}
                                disabled={participantIds.length < 2}
                            >
                                팀 배정 시작 ({participantIds.length}명)
                            </button>
                        </div>
                    </>
                )}
                {confirmation && <ConfirmationModal {...confirmation} onClose={() => setConfirmation(null)} />}
            </div>
        );
    }

    const summaryData = TournamentSummary({
        data,
        settings,
        onApplyPenalty: handleApplyPenalty,
        onApplyBonus: handleApplyBonus,
        onOpenContribution: () => setIsContributionModalOpen(true),
    });

    return (
        <div className="tournament-relay-view">
             <div className="tournament-controls">
                <div className="tournament-header-controls">
                     <button className="btn" onClick={onOpenPlayerManagement}>선수 관리 및 팀 배정</button>
                     <button className="btn danger" onClick={() => setConfirmation({
                        message: "점수·결과만 초기화할까요? 팀 배정(참가자)은 유지됩니다.",
                        actions: [
                            { text: '취소', onClick: () => setConfirmation(null) },
                            { text: '초기화', className: 'danger', onClick: () => {
                                 setData(prev => ({
                                    ...prev,
                                    teams: prev.teams.map(team => ({
                                        ...team,
                                        mannerPenalties: 0,
                                        bonusScore: 0,
                                        players: team.players.map(player => ({
                                            ...player,
                                            game1Result: null,
                                            game2Score: null,
                                            game2LastStone: false,
                                            game3Score: null,
                                        })),
                                    })),
                                 }));
                                 setConfirmation(null);
                            }}
                        ]
                     })}>결과 초기화</button>
                </div>
            </div>
            <div className="relay-view-body">
                <TournamentGames 
                    data={data} 
                    settings={settings}
                    onPlayerChange={handlePlayerChange}
                    onReorderMatchups={handleReorderMatchups}
                    onUniversalPlayerSwap={handleUniversalPlayerSwap}
                    onOpenSwapModal={handleOpenSwapModal}
                    onReorderGames={(fromIndex, toIndex) => {
                        setSettings(prev => {
                            const games = [...prev.games];
                            const [removed] = games.splice(fromIndex, 1);
                            games.splice(toIndex, 0, removed);
                            return { ...prev, games };
                        });
                    }}
                />
                <div className="relay-summary-panel">
                    {summaryData.element}
                </div>
            </div>
             {isSwapModalOpen && (
                <PlayerSwapModal
                    isOpen={isSwapModalOpen}
                    onClose={() => setIsSwapModalOpen(false)}
                    onSwap={handleConfirmSwap}
                    playerToReplace={playerToReplace}
                    availableStudents={availableStudents}
                />
            )}
             {confirmation && <ConfirmationModal {...confirmation} onClose={() => setConfirmation(null)} />}
            {bonusEditorTeam && (
                <ConfirmationModal
                    onClose={() => setBonusEditorTeam(null)}
                    message={(
                        <label className="relay-bonus-editor">
                            {bonusEditorTeam}팀 보너스 점수
                            <input
                                type="number"
                                value={bonusAmount}
                                onChange={event => setBonusAmount(event.target.value)}
                                autoFocus
                            />
                        </label>
                    )}
                    actions={[
                        { text: '취소', onClick: () => setBonusEditorTeam(null) },
                        { text: '적용', className: 'primary', onClick: applyBonus },
                    ]}
                />
            )}
            {isContributionModalOpen && (
                <RelayTeamContributionModal
                    isOpen
                    onClose={() => setIsContributionModalOpen(false)}
                    teams={data.teams}
                    settings={settings}
                    winner={summaryData.winner}
                    awardEventKey={awardEventKey}
                    onAwardBatch={onAwardBatch}
                    isAwarded={isAwarded}
                />
            )}
        </div>
    );
};
