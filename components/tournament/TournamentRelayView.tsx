
import React, { useState, useCallback } from 'react';
import type { Student, TournamentData, TournamentSettings, TournamentPlayer } from '../../types';
import { TournamentGames } from './TournamentGames';
import { TournamentSummary } from './TournamentSummary';
import { PlayerSwapModal } from './PlayerSwapModal';
import { ConfirmationModal } from '../modals/ConfirmationModal';
import { TournamentAwardModal } from './TournamentAwardModal';
import { parseRank } from '../../utils';

interface TournamentRelayViewProps {
    data: TournamentData;
    students: Student[];
    setData: React.Dispatch<React.SetStateAction<TournamentData>>;
    settings: TournamentSettings;
    onBulkAddTransaction: (studentIds: string[], description: string, amount: number) => void;
    onOpenPlayerManagement: () => void;
}

export const TournamentRelayView: React.FC<TournamentRelayViewProps> = (props) => {
    const { data, students, setData, settings, onBulkAddTransaction, onOpenPlayerManagement } = props;
    
    const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
    const [playerToSwap, setPlayerToSwap] = useState<{ teamName: 'A' | 'B', playerIndex: number } | null>(null);
    const [confirmation, setConfirmation] = useState<{ message: React.ReactNode, actions: any[] } | null>(null);
    const [awardModal, setAwardModal] = useState<{ teamName: string, teamType: 'winner' | 'loser' } | null>(null);

    const handlePlayerChange = (teamName: 'A' | 'B', playerIndex: number, field: keyof TournamentPlayer, value: any) => {
        setData(prev => {
            const newTeams = prev.teams.map(team => {
                if (team.name === teamName) {
                    const newPlayers = [...team.players];
                    newPlayers[playerIndex] = { ...newPlayers[playerIndex], [field]: value };
                    return { ...team, players: newPlayers };
                }
                return team;
            });
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
            const teamsCopy = JSON.parse(JSON.stringify(prev.teams));
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

            return { ...prev, teams: teamsCopy };
        });
    }, [setData]);

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
        const amountStr = prompt(`${teamName}팀에게 부여할 보너스 점수를 입력하세요:`, "5");
        const amount = parseInt(amountStr || '0', 10);
        
        if (isNaN(amount) || amount === 0) return;

        setData(prev => {
            const newTeams = prev.teams.map(team => {
                if (team.name === teamName) {
                    return { ...team, bonusScore: (team.bonusScore || 0) + amount };
                }
                return team;
            });
            return { ...prev, teams: newTeams };
        });
    };

    const handleOpenSwapModal = (teamName: 'A' | 'B', playerIndex: number) => {
        setPlayerToSwap({ teamName, playerIndex });
        setIsSwapModalOpen(true);
    };

    const handleConfirmSwap = (newStudent: Student) => {
        if (!playerToSwap) return;
        const { teamName, playerIndex } = playerToSwap;
        
        setData(prev => {
            const teamsCopy = JSON.parse(JSON.stringify(prev.teams));
            const targetTeam = teamsCopy.find((t: any) => t.name === teamName);
            const otherTeam = teamsCopy.find((t: any) => t.name !== teamName);

            if (targetTeam) {
                targetTeam.players[playerIndex] = {
                    studentId: newStudent.id,
                    name: newStudent.name,
                    rank: newStudent.rank,
                    game1Handicap: 0,
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
            return { ...prev, teams: teamsCopy };
        });
        setIsSwapModalOpen(false);
        setPlayerToSwap(null);
    };

    const handleAward = (amount: number, reason: string) => {
        if (!awardModal) return;
        const targetTeam = data.teams.find(t => t.name === awardModal.teamName);
        if (targetTeam) {
            const playerIds = targetTeam.players.map(p => p.studentId);
            onBulkAddTransaction(playerIds, reason, amount);
        }
        setAwardModal(null);
    };

    const availableStudents = students.filter(s => 
        !data.teams.some(team => team.players.some(p => p.studentId === s.id))
    );
    
    const playerToReplace = playerToSwap 
        ? data.teams.find(t => t.name === playerToSwap.teamName)?.players[playerToSwap.playerIndex]
        : null;

    const summaryData = TournamentSummary({
        data, 
        settings, 
        onApplyPenalty: handleApplyPenalty,
        onApplyBonus: handleApplyBonus
    });
    const winnerTeam = summaryData.winner;

    return (
        <div className="tournament-relay-view">
             <div className="tournament-controls">
                <div className="tournament-header-controls">
                     <button className="btn" onClick={onOpenPlayerManagement}>선수 관리 및 팀 배정</button>
                     {winnerTeam && (
                        <>
                            <button className="btn" onClick={() => setAwardModal({ teamName: winnerTeam, teamType: 'winner' })}>🏆 승리팀 시상</button>
                            <button className="btn" onClick={() => setAwardModal({ teamName: winnerTeam === 'A' ? 'B' : 'A', teamType: 'loser' })}>👏 패배팀 시상</button>
                        </>
                    )}
                     <button className="btn danger" onClick={() => setConfirmation({
                        message: "현재까지의 모든 점수와 선수 배치를 초기화하시겠습니까?",
                        actions: [
                            { text: '취소', onClick: () => setConfirmation(null) },
                            { text: '초기화', className: 'danger', onClick: () => {
                                 setData(prev => ({
                                    ...prev,
                                    teams: [{name: 'A', players: [], mannerPenalties: 0, bonusScore: 0}, {name: 'B', players: [], mannerPenalties: 0, bonusScore: 0}],
                                    participantIds: [],
                                 }));
                                 setConfirmation(null);
                            }}
                        ]
                     })}>전체 초기화</button>
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
             {awardModal && <TournamentAwardModal isOpen={!!awardModal} onClose={() => setAwardModal(null)} {...awardModal} onAward={handleAward} />}
        </div>
    );
};
