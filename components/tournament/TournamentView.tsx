
import React, { useState } from 'react';
import type { Student, TournamentData, TournamentSettings, SwissPlayer, MissionBadukPlayer, TournamentPlayer } from '../../types';
import { TournamentRelayView } from './TournamentRelayView';
import { TournamentBracketView } from './TournamentBracketView';
import { TournamentSwissView } from './TournamentSwissView';
import { TournamentHybridView } from './TournamentHybridView';
import { TournamentMissionView } from './TournamentMissionView';
import { TournamentPlayerManagementModal } from './TournamentPlayerManagementModal';
import { TournamentSettingsModal } from '../modals/TournamentSettingsModal';
import { TournamentSwissPrizeModal } from './TournamentSwissPrizeModal';
import { generateId, parseRank } from '../../utils';

interface TournamentViewProps {
    students: Student[];
    data: TournamentData;
    setData: React.Dispatch<React.SetStateAction<TournamentData>>;
    settings: TournamentSettings;
    setSettings: React.Dispatch<React.SetStateAction<TournamentSettings>>;
    onBulkAddTransaction: (studentIds: string[], description: string, amount: number) => void;
}

type TournamentTab = 'relay' | 'bracket' | 'swiss' | 'hybrid' | 'mission';

export const TournamentView = (props: TournamentViewProps) => {
    const { students, data, setData, settings, setSettings, onBulkAddTransaction } = props;
    const [activeTab, setActiveTab] = useState<TournamentTab>('relay');
    const [isPlayerManagementModalOpen, setIsPlayerManagementModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isSwissPrizeModalOpen, setIsSwissPrizeModalOpen] = useState(false);

    const handleUpdateParticipants = (ids: string[]) => {
        setData(prev => ({ ...prev, participantIds: ids }));
    };

    const handleAssignTeams = (mode: 'random' | 'ranked', ids?: string[]) => {
        const participantIdsToUse = ids || data.participantIds;

        const participants = participantIdsToUse
            .map(id => students.find(s => s.id === id))
            .filter((s): s is Student => !!s);
        
        let sortedParticipants: Student[];
        
        if (mode === 'ranked') {
            sortedParticipants = [...participants].sort((a, b) => parseRank(b.rank) - parseRank(a.rank));
        } else {
            sortedParticipants = [...participants].sort(() => 0.5 - Math.random());
        }
        
        const teamA: TournamentPlayer[] = [];
        const teamB: TournamentPlayer[] = [];
        
        sortedParticipants.forEach((p, i) => {
            const player: TournamentPlayer = {
                studentId: p.id, name: p.name, rank: p.rank,
                game1Handicap: 0, game1Color: 'black', game1Result: null,
                game2Score: null, game2LastStone: false, game3Score: null,
            };
            if (i % 2 === 0) teamA.push(player);
            else teamB.push(player);
        });

        // Auto-assign colors based on rank difference immediately after assignment
        const maxLen = Math.max(teamA.length, teamB.length);
        for(let i=0; i<maxLen; i++) {
            if (teamA[i] && teamB[i]) {
                const rankA = parseRank(teamA[i].rank);
                const rankB = parseRank(teamB[i].rank);
                if (rankA > rankB) { // A is stronger
                    teamA[i].game1Color = 'white';
                    teamB[i].game1Color = 'black';
                } else if (rankB > rankA) { // B is stronger
                    teamB[i].game1Color = 'white';
                    teamA[i].game1Color = 'black';
                }
                // If equal, default is black (from init), can be changed manually
            }
        }
        
        setData(prev => ({
            ...prev,
            participantIds: participantIdsToUse,
            teams: [
                { name: 'A', players: teamA, mannerPenalties: 0 },
                { name: 'B', players: teamB, mannerPenalties: 0 }
            ]
        }));
        setIsPlayerManagementModalOpen(false);
    };

    const handleStartSwiss = (mode: 'random' | 'ranked') => {
        const participants = data.participantIds
            .map(id => students.find(s => s.id === id))
            .filter((s): s is Student => !!s);
        
        const swissPlayers: SwissPlayer[] = participants.map(p => ({
            studentId: p.id,
            name: p.name,
            score: 0,
            opponents: [],
            sos: 0,
            sosos: 0,
        }));

        let sortedPlayers: SwissPlayer[];
        if (mode === 'ranked') {
             sortedPlayers = [...swissPlayers].sort((a, b) => {
                const sA = students.find(s => s.id === a.studentId);
                const sB = students.find(s => s.id === b.studentId);
                return parseRank(sB?.rank || '') - parseRank(sA?.rank || '');
            });
        } else {
            sortedPlayers = [...swissPlayers].sort(() => 0.5 - Math.random());
        }
        
        const firstRoundMatches: any[] = [];
        if (sortedPlayers.length % 2 !== 0) {
            const byePlayerIndex = sortedPlayers.length - 1; 
            const byePlayer = sortedPlayers[byePlayerIndex];
            byePlayer.score += 1;
            byePlayer.opponents.push('BYE');
            firstRoundMatches.push({
                id: generateId(),
                players: [byePlayer.studentId, 'BYE'],
                winnerId: byePlayer.studentId
            });
            sortedPlayers.splice(byePlayerIndex, 1);
        }

        for (let i = 0; i < sortedPlayers.length; i += 2) {
            firstRoundMatches.push({
                id: generateId(),
                players: [sortedPlayers[i].studentId, sortedPlayers[i + 1].studentId],
                winnerId: null
            });
        }

        setData(prev => ({
            ...prev,
            swiss: {
                status: 'in_progress',
                players: swissPlayers,
                rounds: [firstRoundMatches]
            }
        }));
        setIsPlayerManagementModalOpen(false);
    };

    const handleInitMissionBaduk = (ids?: string[]) => {
        const participantIdsToUse = ids || data.participantIds;

        if (participantIdsToUse.length === 0) {
             alert('참가 선수가 없습니다.');
             return;
        }
        
        const participants = participantIdsToUse
            .map(id => students.find(s => s.id === id))
            .filter((s): s is Student => !!s);

        setData(prev => {
            const existingPlayers = prev.missionBaduk?.players || [];
            const existingPlayerMap = new Map<string, MissionBadukPlayer>();
            existingPlayers.forEach(p => existingPlayerMap.set(p.studentId, p));

            const newPlayers = participants.map(p => {
                if (existingPlayerMap.has(p.id)) {
                    return { ...existingPlayerMap.get(p.id)!, name: p.name };
                }
                return {
                    studentId: p.id,
                    name: p.name,
                    status: 'waiting' as const,
                    score: 0,
                    matches: []
                };
            });

            return {
                ...prev,
                participantIds: participantIdsToUse,
                missionBaduk: {
                    players: newPlayers
                }
            };
        });
        setIsPlayerManagementModalOpen(false);
    };

    // Swiss League Logic Helpers
    const handleSetSwissWinner = (roundIndex: number, matchId: string, winnerId: string | null) => {
         setData(prev => {
            if (!prev.swiss) return prev;
            const newSwiss = JSON.parse(JSON.stringify(prev.swiss));
            const match = newSwiss.rounds[roundIndex].find((m: any) => m.id === matchId);
            if (match) {
                match.winnerId = winnerId;
                
                newSwiss.players.forEach((p: SwissPlayer) => p.score = 0);
                newSwiss.rounds.flat().forEach((m: any) => {
                    if (m.winnerId && m.winnerId !== 'BYE') {
                        const winner = newSwiss.players.find((p: SwissPlayer) => p.studentId === m.winnerId);
                        if (winner) winner.score += 1;
                    }
                });
            }
            return { ...prev, swiss: newSwiss };
         });
    };

    const generatePairings = (players: SwissPlayer[], existingRounds: any[][]) => {
         const sorted = [...players].sort((a, b) => {
             if (b.score !== a.score) return b.score - a.score;
             return 0.5 - Math.random(); // Randomness for rematch
         });

         const pairedIds = new Set<string>();
         const nextRoundMatches: any[] = [];
         
         const remainingPlayers = sorted.filter(p => !pairedIds.has(p.studentId));
         if (remainingPlayers.length % 2 !== 0) {
             let byeCandidateIndex = remainingPlayers.length - 1;
             while (byeCandidateIndex >= 0) {
                 const p = remainingPlayers[byeCandidateIndex];
                 if (!p.opponents.includes('BYE')) {
                     break;
                 }
                 byeCandidateIndex--;
             }
             if (byeCandidateIndex < 0) byeCandidateIndex = remainingPlayers.length - 1;
             
             const byePlayer = remainingPlayers[byeCandidateIndex];
             pairedIds.add(byePlayer.studentId);
             
             byePlayer.score += 1;
             byePlayer.opponents.push('BYE');
             
             nextRoundMatches.push({
                id: generateId(),
                players: [byePlayer.studentId, 'BYE'],
                winnerId: byePlayer.studentId
             });
         }

         const toPair = sorted.filter(p => !pairedIds.has(p.studentId));
         
         for (let i = 0; i < toPair.length; i++) {
             if (pairedIds.has(toPair[i].studentId)) continue;
             
             const p1 = toPair[i];
             let bestOpponentIndex = -1;
             
             for (let j = i + 1; j < toPair.length; j++) {
                 if (pairedIds.has(toPair[j].studentId)) continue;
                 const p2 = toPair[j];
                 if (!p1.opponents.includes(p2.studentId)) {
                     bestOpponentIndex = j;
                     if (p1.score === p2.score) break;
                 }
             }
             
             if (bestOpponentIndex === -1) {
                  for (let j = i + 1; j < toPair.length; j++) {
                     if (!pairedIds.has(toPair[j].studentId)) {
                         bestOpponentIndex = j;
                         break;
                     }
                  }
             }
             
             if (bestOpponentIndex !== -1) {
                 const p2 = toPair[bestOpponentIndex];
                 pairedIds.add(p1.studentId);
                 pairedIds.add(p2.studentId);
                 
                 p1.opponents.push(p2.studentId);
                 p2.opponents.push(p1.studentId);
                 
                 nextRoundMatches.push({
                    id: generateId(),
                    players: [p1.studentId, p2.studentId],
                    winnerId: null
                 });
             }
         }
         return nextRoundMatches;
    };

    const handleGenerateNextRoundSwiss = () => {
        setData(prev => {
             if (!prev.swiss) return prev;
             const newSwiss = JSON.parse(JSON.stringify(prev.swiss));
             const nextRoundMatches = generatePairings(newSwiss.players, newSwiss.rounds);
             newSwiss.rounds.push(nextRoundMatches);
             return { ...prev, swiss: newSwiss };
        });
    };

    const handleCancelLastRoundSwiss = () => {
        setData(prev => {
             if (!prev.swiss || prev.swiss.rounds.length <= 1) return prev;
             const newSwiss = JSON.parse(JSON.stringify(prev.swiss));
             
             const lastRound = newSwiss.rounds.pop();
             
             lastRound.forEach((m: any) => {
                 const [id1, id2] = m.players;
                 const p1 = newSwiss.players.find((p: any) => p.studentId === id1);
                 const p2 = id2 !== 'BYE' ? newSwiss.players.find((p: any) => p.studentId === id2) : null;
                 
                 if (m.winnerId) {
                     const winner = newSwiss.players.find((p: any) => p.studentId === m.winnerId);
                     if (winner) winner.score -= 1;
                 }
                 
                 if (p1 && id2) {
                    p1.opponents = p1.opponents.filter((oid: string) => oid !== id2);
                 }
                 if (p2 && id1) {
                    p2.opponents = p2.opponents.filter((oid: string) => oid !== id1);
                 }
             });
             
             return { ...prev, swiss: newSwiss };
        });
    };
    
    const handleRematchSwiss = () => {
        setData(prev => {
             if (!prev.swiss || prev.swiss.rounds.length === 0) return prev;
             const newSwiss = JSON.parse(JSON.stringify(prev.swiss));
             
             // 1. Revert stats from the current last round
             const lastRound = newSwiss.rounds.pop();
             lastRound.forEach((m: any) => {
                 const [id1, id2] = m.players;
                 const p1 = newSwiss.players.find((p: any) => p.studentId === id1);
                 const p2 = id2 !== 'BYE' ? newSwiss.players.find((p: any) => p.studentId === id2) : null;
                 
                 if (m.winnerId) {
                     const winner = newSwiss.players.find((p: any) => p.studentId === m.winnerId);
                     if (winner) winner.score -= 1;
                 }
                 
                 if (p1 && id2) {
                    p1.opponents = p1.opponents.filter((oid: string) => oid !== id2);
                 }
                 if (p2 && id1) {
                    p2.opponents = p2.opponents.filter((oid: string) => oid !== id1);
                 }
             });

             // 2. Generate new pairings
             const nextRoundMatches = generatePairings(newSwiss.players, newSwiss.rounds);
             newSwiss.rounds.push(nextRoundMatches);
             
             return { ...prev, swiss: newSwiss };
        });
    };
    
    const handleSwissAwardPrizes = (prizes: { first: number, second: number, third: number, participant: number }) => {
        if (!data.swiss) return;
        const sorted = [...data.swiss.players].sort((a, b) => b.score - a.score || b.sos - a.sos || b.sosos - a.sosos);
        
        if (sorted.length > 0 && prizes.first > 0) onBulkAddTransaction([sorted[0].studentId], '스위스 리그 1위', prizes.first);
        if (sorted.length > 1 && prizes.second > 0) onBulkAddTransaction([sorted[1].studentId], '스위스 리그 2위', prizes.second);
        if (sorted.length > 2 && prizes.third > 0) onBulkAddTransaction([sorted[2].studentId], '스위스 리그 3위', prizes.third);
        
        const participants = sorted.slice(3).map(p => p.studentId);
        if (participants.length > 0 && prizes.participant > 0) {
            onBulkAddTransaction(participants, '스위스 리그 참가상', prizes.participant);
        }
        
        setIsSwissPrizeModalOpen(false);
        alert('시상이 완료되었습니다.');
    };

    return (
        <div className="tournament-view">
            <div className="view-header-actions">
                <div className="view-toggle">
                    <button className={`toggle-btn ${activeTab === 'relay' ? 'active' : ''}`} onClick={() => setActiveTab('relay')}>팀 대항전</button>
                    <button className={`toggle-btn ${activeTab === 'bracket' ? 'active' : ''}`} onClick={() => setActiveTab('bracket')}>토너먼트</button>
                    <button className={`toggle-btn ${activeTab === 'swiss' ? 'active' : ''}`} onClick={() => setActiveTab('swiss')}>스위스리그</button>
                    <button className={`toggle-btn ${activeTab === 'hybrid' ? 'active' : ''}`} onClick={() => setActiveTab('hybrid')}>예선+본선</button>
                    <button className={`toggle-btn ${activeTab === 'mission' ? 'active' : ''}`} onClick={() => setActiveTab('mission')}>미션바둑</button>
                </div>
                <button className="btn" onClick={() => setIsSettingsModalOpen(true)}>대회 설정</button>
            </div>

            <div className="tournament-content">
                {activeTab === 'relay' && (
                    <TournamentRelayView 
                        data={data} 
                        students={students} 
                        setData={setData} 
                        settings={settings} 
                        onBulkAddTransaction={onBulkAddTransaction}
                        onOpenPlayerManagement={() => setIsPlayerManagementModalOpen(true)}
                    />
                )}
                {activeTab === 'bracket' && (
                    <TournamentBracketView 
                        data={data} 
                        students={students} 
                        setData={setData} 
                        settings={settings} 
                        onBulkAddTransaction={onBulkAddTransaction}
                        onOpenPlayerManagement={() => setIsPlayerManagementModalOpen(true)}
                    />
                )}
                 {activeTab === 'swiss' && (
                    <TournamentSwissView
                        swissData={data.swiss}
                        onStartSwiss={handleStartSwiss}
                        onSetWinner={handleSetSwissWinner}
                        onGenerateNextRound={handleGenerateNextRoundSwiss}
                        onCancelLastRound={handleCancelLastRoundSwiss}
                        onRematchRound={handleRematchSwiss}
                        onOpenPrizeModal={() => setIsSwissPrizeModalOpen(true)}
                        onPlayerSwap={setData}
                        onOpenPlayerManagement={() => setIsPlayerManagementModalOpen(true)}
                    />
                )}
                {activeTab === 'hybrid' && (
                    <TournamentHybridView 
                        data={data} 
                        students={students} 
                        setData={setData} 
                        settings={settings} 
                        onOpenPlayerManagement={() => setIsPlayerManagementModalOpen(true)}
                        onBulkAddTransaction={onBulkAddTransaction}
                    />
                )}
                {activeTab === 'mission' && (
                    <TournamentMissionView
                        data={data}
                        students={students}
                        setData={setData}
                        settings={settings}
                        onOpenPlayerManagement={() => setIsPlayerManagementModalOpen(true)}
                        onBulkAddTransaction={onBulkAddTransaction}
                    />
                )}
            </div>

            {isPlayerManagementModalOpen && (
                <TournamentPlayerManagementModal
                    isOpen={isPlayerManagementModalOpen}
                    onClose={() => setIsPlayerManagementModalOpen(false)}
                    allStudents={students}
                    participantIds={data.participantIds}
                    onUpdateParticipants={handleUpdateParticipants}
                    onAssignTeams={handleAssignTeams}
                    currentView={activeTab}
                    onStartSwiss={handleStartSwiss}
                    onInitMission={handleInitMissionBaduk}
                />
            )}
            
            {isSettingsModalOpen && (
                <TournamentSettingsModal
                    isOpen={isSettingsModalOpen}
                    onClose={() => setIsSettingsModalOpen(false)}
                    settings={settings}
                    onUpdateSettings={setSettings}
                    activeTab={activeTab}
                />
            )}
             {isSwissPrizeModalOpen && (
                <TournamentSwissPrizeModal
                    isOpen={isSwissPrizeModalOpen}
                    onClose={() => setIsSwissPrizeModalOpen(false)}
                    settings={settings}
                    swissData={data.swiss}
                    onAwardPrizes={handleSwissAwardPrizes}
                />
            )}
        </div>
    );
};
