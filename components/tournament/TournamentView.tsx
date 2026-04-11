
import React, { useState } from 'react';
import type {
    Student,
    TournamentData,
    TournamentSettings,
    SwissPlayer,
    SwissGroupData,
    MissionBadukPlayer,
    TournamentPlayer,
    SwissMatch,
    FullLeagueMatch,
    FullLeagueData,
    TournamentSwissGroupPrizes,
} from '../../types';
import { TournamentRelayView } from './TournamentRelayView';
import { TournamentBracketView } from './TournamentBracketView';
import { TournamentSwissView } from './TournamentSwissView';
import { TournamentHybridView } from './TournamentHybridView';
import { TournamentFullLeagueView } from './TournamentFullLeagueView';
import { TournamentDoubleElimView } from './TournamentDoubleElimView';
import { TournamentMissionView } from './TournamentMissionView';
import { TournamentPlayerManagementModal } from './TournamentPlayerManagementModal';
import { TournamentSettingsModal } from '../modals/TournamentSettingsModal';
import { TournamentSwissPrizeModal, type SwissPrizeAwardEntry } from './TournamentSwissPrizeModal';
import { generateId, parseRank, sortSwissPlayers } from '../../utils';
import { DEFAULT_BYE_PRIORITY, pickSwissOddByePoolIndex, pickSwissByeSortedIndex } from '../../utils/byePlacement';
import { buildDoubleElim } from '../../utils/doubleElimBracket';
import { defaultSwissGroupPrize, parseSwissGroupSizes, forEachSwissStylePayout } from '../../utils/tournamentPrizes';
import { swapSwissPlayersBetweenGroups } from '../../utils/swissGroupSwap';

/** orderedPool: 대진 순서(같은 SwissPlayer 객체 참조). 부전승 시 객체를 수정함. [0]이 최강(또는 무작위 시드의 앞쪽). */
function buildSwissFirstRoundMatches(orderedPool: SwissPlayer[], byePriority = DEFAULT_BYE_PRIORITY): SwissMatch[] {
    const firstRoundMatches: SwissMatch[] = [];
    const pool = [...orderedPool];
    if (pool.length % 2 !== 0) {
        const byePlayerIndex = pickSwissOddByePoolIndex(pool.length, byePriority);
        const byePlayer = pool[byePlayerIndex];
        byePlayer.score += 1;
        byePlayer.opponents.push('BYE');
        firstRoundMatches.push({
            id: generateId(),
            players: [byePlayer.studentId, 'BYE'],
            winnerId: byePlayer.studentId,
        });
        pool.splice(byePlayerIndex, 1);
    }
    for (let i = 0; i < pool.length; i += 2) {
        firstRoundMatches.push({
            id: generateId(),
            players: [pool[i].studentId, pool[i + 1].studentId],
            winnerId: null,
        });
    }
    return firstRoundMatches;
}

interface TournamentViewProps {
    students: Student[];
    data: TournamentData;
    setData: React.Dispatch<React.SetStateAction<TournamentData>>;
    settings: TournamentSettings;
    setSettings: React.Dispatch<React.SetStateAction<TournamentSettings>>;
    onBulkAddTransaction: (studentIds: string[], description: string, amount: number) => void;
}

type TournamentTab = 'relay' | 'bracket' | 'swiss' | 'hybrid' | 'fullleague' | 'doubleelim' | 'mission';

export const TournamentView = (props: TournamentViewProps) => {
    const { students, data, setData, settings, setSettings, onBulkAddTransaction } = props;
    const [activeTab, setActiveTab] = useState<TournamentTab>('relay');
    const [isPlayerManagementModalOpen, setIsPlayerManagementModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isSwissPrizeModalOpen, setIsSwissPrizeModalOpen] = useState(false);

    const getTabParticipantIds = (tab: TournamentTab): string[] => {
        switch (tab) {
            case 'relay': return data.relayParticipantIds || [];
            case 'bracket': return data.bracketParticipantIds || [];
            case 'swiss': return data.swissParticipantIds || [];
            case 'hybrid': return data.hybridParticipantIds || [];
            case 'fullleague': return data.fullLeagueParticipantIds || [];
            case 'doubleelim': return data.doubleElimParticipantIds || [];
            case 'mission': return data.missionParticipantIds || [];
            default: return [];
        }
    };

    const handleUpdateParticipants = (ids: string[]) => {
        setData(prev => {
            const updates: Partial<TournamentData> = {};
            if (activeTab === 'relay') updates.relayParticipantIds = ids;
            else if (activeTab === 'bracket') updates.bracketParticipantIds = ids;
            else if (activeTab === 'swiss') updates.swissParticipantIds = ids;
            else if (activeTab === 'hybrid') updates.hybridParticipantIds = ids;
            else if (activeTab === 'fullleague') updates.fullLeagueParticipantIds = ids;
            else if (activeTab === 'doubleelim') updates.doubleElimParticipantIds = ids;
            else if (activeTab === 'mission') updates.missionParticipantIds = ids;
            return { ...prev, ...updates };
        });
    };

    const handleInitFullLeague = (ids: string[]) => {
        const participants = ids.map(id => students.find(s => s.id === id)).filter((s): s is Student => !!s);
        if (participants.length < 2) {
            alert('풀리그를 시작하려면 최소 2명이 필요합니다.');
            return;
        }
        const players = participants.map(p => ({ studentId: p.id, name: p.name, wins: 0, losses: 0 }));
        const matches: FullLeagueMatch[] = [];
        for (let i = 0; i < participants.length; i++) {
            for (let j = i + 1; j < participants.length; j++) {
                matches.push({ id: generateId(), player1Id: participants[i].id, player2Id: participants[j].id, winnerId: null });
            }
        }
        setData(prev => ({ ...prev, fullLeagueParticipantIds: ids, fullLeague: { players, matches } }));
        setIsPlayerManagementModalOpen(false);
    };

    const handleInitDoubleElim = (ids: string[]) => {
        const list = ids.filter(id => students.some(s => s.id === id));
        if (list.length < 2) {
            alert('더블엘리미네이션을 시작하려면 최소 2명이 필요합니다.');
            return;
        }
        const sorted = [...list].sort((a, b) => {
            const ra = students.find(s => s.id === a);
            const rb = students.find(s => s.id === b);
            return parseRank(rb?.rank || '') - parseRank(ra?.rank || '');
        });
        const prio = settings.byePriority ?? DEFAULT_BYE_PRIORITY;
        setData(prev => ({
            ...prev,
            doubleElimParticipantIds: sorted,
            doubleElim: buildDoubleElim(sorted, prio),
        }));
        setIsPlayerManagementModalOpen(false);
    };

    const handleAssignTeams = (mode: 'random' | 'ranked', ids: string[]) => {
        const participantIdsToUse = ids;

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

        const maxLen = Math.max(teamA.length, teamB.length);
        for(let i=0; i<maxLen; i++) {
            if (teamA[i] && teamB[i]) {
                const rankA = parseRank(teamA[i].rank);
                const rankB = parseRank(teamB[i].rank);
                if (rankA > rankB) { 
                    teamA[i].game1Color = 'white';
                    teamB[i].game1Color = 'black';
                } else if (rankB > rankA) { 
                    teamB[i].game1Color = 'white';
                    teamA[i].game1Color = 'black';
                }
            }
        }
        
        setData(prev => ({
            ...prev,
            relayParticipantIds: participantIdsToUse,
            teams: [
                { name: 'A', players: teamA, mannerPenalties: 0 },
                { name: 'B', players: teamB, mannerPenalties: 0 }
            ]
        }));
        setIsPlayerManagementModalOpen(false);
    };

    const handleStartSwiss = (mode: 'random' | 'ranked', ids: string[]) => {
        const participantIdsToUse = ids;
        const participants = participantIdsToUse
            .map(id => students.find(s => s.id === id))
            .filter((s): s is Student => !!s);

        if (participants.length === 0) {
            alert('참가 선수가 없습니다.');
            return;
        }

        const useGroups = settings.swissUseGroups === true;
        const groupSizes = parseSwissGroupSizes(settings.swissGroupSizes);
        const groupSum = groupSizes.reduce((a, b) => a + b, 0);

        if (useGroups) {
            if (groupSizes.length === 0) {
                alert('대회 설정에서 조 인원을 입력해 주세요. (예: 4,4,8)');
                return;
            }
            if (groupSum !== participants.length) {
                alert(
                    `조별 스위스: 조 인원 합(${groupSum}명)이 참가자 수(${participants.length}명)와 같아야 합니다.\n` +
                        `대회 설정 → 스위스 리그에서 조 인원을 수정하거나 참가자를 조정해 주세요.`
                );
                return;
            }
        }

        let orderedStudents = [...participants];
        if (mode === 'ranked') {
            orderedStudents.sort((a, b) => parseRank(b.rank || '') - parseRank(a.rank || ''));
        } else {
            orderedStudents.sort(() => 0.5 - Math.random());
        }

        if (useGroups && groupSizes.length > 0) {
            const groups: SwissGroupData[] = [];
            let offset = 0;
            groupSizes.forEach((size, idx) => {
                const slice = orderedStudents.slice(offset, offset + size);
                offset += size;
                const groupPlayers: SwissPlayer[] = slice.map(p => ({
                    studentId: p.id,
                    name: p.name,
                    score: 0,
                    opponents: [],
                    sos: 0,
                    sosos: 0,
                }));
                const firstRound = buildSwissFirstRoundMatches(groupPlayers, settings.byePriority ?? DEFAULT_BYE_PRIORITY);
                groups.push({
                    id: generateId(),
                    label: `${idx + 1}조 (${size}명)`,
                    players: groupPlayers,
                    rounds: [firstRound],
                });
            });
            const allPlayers = groups.flatMap(g => g.players);
            setData(prev => ({
                ...prev,
                swissParticipantIds: participantIdsToUse,
                swiss: {
                    status: 'in_progress',
                    players: allPlayers,
                    rounds: [],
                    groups,
                },
            }));
            setIsPlayerManagementModalOpen(false);
            return;
        }

        const swissPlayers: SwissPlayer[] = participants.map(p => ({
            studentId: p.id,
            name: p.name,
            score: 0,
            opponents: [],
            sos: 0,
            sosos: 0,
        }));

        let sortedPlayers: SwissPlayer[] = [...swissPlayers];
        if (mode === 'ranked') {
            sortedPlayers.sort((a, b) => {
                const sA = students.find(s => s.id === a.studentId);
                const sB = students.find(s => s.id === b.studentId);
                return parseRank(sB?.rank || '') - parseRank(sA?.rank || '');
            });
        } else {
            sortedPlayers.sort(() => 0.5 - Math.random());
        }

        const firstRoundMatches = buildSwissFirstRoundMatches(sortedPlayers, settings.byePriority ?? DEFAULT_BYE_PRIORITY);

        setData(prev => ({
            ...prev,
            swissParticipantIds: participantIdsToUse,
            swiss: {
                status: 'in_progress',
                players: swissPlayers,
                rounds: [firstRoundMatches],
            },
        }));
        setIsPlayerManagementModalOpen(false);
    };

    const handleInitHybrid = (ids: string[]) => {
        const participantIdsToUse = ids;
        const participants = participantIdsToUse
            .map(id => students.find(s => s.id === id))
            .filter((s): s is Student => !!s);
        
        if (participants.length < (settings.hybridAdvanceCount || 8)) {
            alert(`참가 인원(${participants.length}명)이 본선 진출 인원(${settings.hybridAdvanceCount || 8}명)보다 적습니다.`);
            return;
        }

        let sortedParticipants: Student[];
        if (settings.hybridMode === 'rank') {
            sortedParticipants = [...participants].sort((a, b) => parseRank(b.rank) - parseRank(a.rank));
        } else {
            sortedParticipants = [...participants].sort(() => 0.5 - Math.random());
        }

        const numGroups = settings.hybridGroupCount || Math.ceil(participants.length / 5);
        const groups: Student[][] = Array.from({ length: numGroups }, () => []);

        sortedParticipants.forEach((player, index) => {
            const groupIndex = index % numGroups;
            const reverseGroupIndex = numGroups - 1 - groupIndex;
            if (Math.floor(index / numGroups) % 2 === 0) {
                groups[groupIndex].push(player);
            } else {
                groups[reverseGroupIndex].push(player);
            }
        });

        const swissPlayers: SwissPlayer[] = participants.map(p => ({
            studentId: p.id,
            name: p.name,
            score: 0,
            opponents: [],
            sos: 0,
            sosos: 0,
        }));

        const preliminaryGroups: SwissMatch[][] = groups.map(group => {
            const matches: SwissMatch[] = [];
            for (let i = 0; i < group.length; i++) {
                for (let j = i + 1; j < group.length; j++) {
                    matches.push({
                        id: generateId(),
                        players: [group[i].id, group[j].id],
                        winnerId: null,
                    });
                }
            }
            return matches;
        });
        
        setData(prev => ({
            ...prev,
            hybridParticipantIds: participantIdsToUse,
            hybrid: {
                players: swissPlayers,
                preliminaryGroups,
                bracket: null,
            }
        }));
        setIsPlayerManagementModalOpen(false);
    };

    const handleInitMissionBaduk = (ids: string[]) => {
        const participantIdsToUse = ids;

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
                    matches: [],
                    prizeGroupIndex: 0,
                };
            });

            return {
                ...prev,
                missionParticipantIds: participantIdsToUse,
                missionBaduk: {
                    players: newPlayers
                }
            };
        });
        setIsPlayerManagementModalOpen(false);
    };

    const handleSetSwissWinner = (groupIndex: number | undefined, roundIndex: number, matchId: string, winnerId: string | null) => {
        setData(prev => {
            if (!prev.swiss) return prev;
            const newSwiss = JSON.parse(JSON.stringify(prev.swiss));
            const targetRounds =
                groupIndex !== undefined && newSwiss.groups?.[groupIndex]
                    ? newSwiss.groups[groupIndex].rounds
                    : newSwiss.rounds;
            const targetPlayers =
                groupIndex !== undefined && newSwiss.groups?.[groupIndex]
                    ? newSwiss.groups[groupIndex].players
                    : newSwiss.players;

            const match = targetRounds[roundIndex]?.find((m: any) => m.id === matchId);
            if (match) {
                match.winnerId = winnerId;

                targetPlayers.forEach((p: SwissPlayer) => (p.score = 0));
                targetRounds.flat().forEach((m: any) => {
                    if (m.winnerId && m.winnerId !== 'BYE') {
                        const winner = targetPlayers.find((p: SwissPlayer) => p.studentId === m.winnerId);
                        if (winner) winner.score += 1;
                    }
                });
            }
            return { ...prev, swiss: newSwiss };
        });
    };

    const generatePairings = (players: SwissPlayer[], existingRounds: any[][]) => {
         const byePriority = settings.byePriority ?? DEFAULT_BYE_PRIORITY;
         const sorted = [...players].sort((a, b) => {
             if (b.score !== a.score) return b.score - a.score;
             return 0.5 - Math.random(); 
         });

         const pairedIds = new Set<string>();
         const nextRoundMatches: any[] = [];
         
         const remainingPlayers = sorted.filter(p => !pairedIds.has(p.studentId));
         if (remainingPlayers.length % 2 !== 0) {
             const byeCandidateIndex = pickSwissByeSortedIndex(remainingPlayers, byePriority);
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

    const handleGenerateNextRoundSwiss = (groupIndex?: number) => {
        setData(prev => {
            if (!prev.swiss) return prev;
            const newSwiss = JSON.parse(JSON.stringify(prev.swiss));
            if (groupIndex !== undefined && newSwiss.groups?.[groupIndex]) {
                const g = newSwiss.groups[groupIndex];
                const nextRoundMatches = generatePairings(g.players, g.rounds);
                g.rounds.push(nextRoundMatches);
            } else {
                const nextRoundMatches = generatePairings(newSwiss.players, newSwiss.rounds);
                newSwiss.rounds.push(nextRoundMatches);
            }
            return { ...prev, swiss: newSwiss };
        });
    };

    const handleCancelLastRoundSwiss = (groupIndex?: number) => {
        setData(prev => {
            if (!prev.swiss) return prev;
            const newSwiss = JSON.parse(JSON.stringify(prev.swiss));
            const targetRounds =
                groupIndex !== undefined && newSwiss.groups?.[groupIndex]
                    ? newSwiss.groups[groupIndex].rounds
                    : newSwiss.rounds;
            const targetPlayers =
                groupIndex !== undefined && newSwiss.groups?.[groupIndex]
                    ? newSwiss.groups[groupIndex].players
                    : newSwiss.players;

            if (targetRounds.length <= 1) return prev;
            const lastRound = targetRounds.pop();

            lastRound.forEach((m: any) => {
                const [id1, id2] = m.players;
                const p1 = targetPlayers.find((p: any) => p.studentId === id1);
                const p2 = id2 !== 'BYE' ? targetPlayers.find((p: any) => p.studentId === id2) : null;

                if (m.winnerId) {
                    const winner = targetPlayers.find((p: any) => p.studentId === m.winnerId);
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
    
    const handleRematchSwiss = (groupIndex?: number) => {
        setData(prev => {
            if (!prev.swiss) return prev;
            const newSwiss = JSON.parse(JSON.stringify(prev.swiss));
            const targetRounds =
                groupIndex !== undefined && newSwiss.groups?.[groupIndex]
                    ? newSwiss.groups[groupIndex].rounds
                    : newSwiss.rounds;
            const targetPlayers =
                groupIndex !== undefined && newSwiss.groups?.[groupIndex]
                    ? newSwiss.groups[groupIndex].players
                    : newSwiss.players;

            if (targetRounds.length === 0) return prev;
            const lastRound = targetRounds.pop();
            lastRound.forEach((m: any) => {
                const [id1, id2] = m.players;
                const p1 = targetPlayers.find((p: any) => p.studentId === id1);
                const p2 = id2 !== 'BYE' ? targetPlayers.find((p: any) => p.studentId === id2) : null;

                if (m.winnerId) {
                    const winner = targetPlayers.find((p: any) => p.studentId === m.winnerId);
                    if (winner) winner.score -= 1;
                }

                if (p1 && id2) {
                    p1.opponents = p1.opponents.filter((oid: string) => oid !== id2);
                }
                if (p2 && id1) {
                    p2.opponents = p2.opponents.filter((oid: string) => oid !== id1);
                }
            });

            const nextRoundMatches = generatePairings(targetPlayers, targetRounds);
            targetRounds.push(nextRoundMatches);

            return { ...prev, swiss: newSwiss };
        });
    };
    
    const handleSwissAwardPrizes = (entries: SwissPrizeAwardEntry[]) => {
        if (!data.swiss) return;

        const awardGroup = (sorted: SwissPlayer[], labelPrefix: string, prizes: TournamentSwissGroupPrizes) => {
            forEachSwissStylePayout(sorted, prizes, settings, labelPrefix, (ids, desc, amt) =>
                onBulkAddTransaction(ids, desc, amt)
            );
        };

        if (data.swiss.groups?.length) {
            entries.forEach(entry => {
                const g = data.swiss!.groups![entry.groupIndex];
                if (!g) return;
                const sorted = sortSwissPlayers(g.players, g.rounds);
                const shortLabel = g.label.replace(/\s*\([^)]*\)\s*$/, '');
                awardGroup(sorted, `스위스 리그 ${shortLabel}`, entry.prizes);
            });
        } else {
            const sorted = sortSwissPlayers(data.swiss.players, data.swiss.rounds);
            const prizes = entries[0]?.prizes ?? defaultSwissGroupPrize(settings);
            awardGroup(sorted, '스위스 리그', prizes);
        }

        setIsSwissPrizeModalOpen(false);
        alert('시상이 완료되었습니다.');
    };

    const canResetSwiss =
        (data.swissParticipantIds?.length ?? 0) > 0 || data.swiss != null;

    const handleResetSwiss = () => {
        if (!canResetSwiss) return;
        if (
            !confirm(
                '스위스 리그를 초기화할까요?\n대진표와 참가자 선택이 모두 지워지며, 이 작업은 되돌릴 수 없습니다.'
            )
        ) {
            return;
        }
        setIsSwissPrizeModalOpen(false);
        setData(prev => ({
            ...prev,
            swissParticipantIds: [],
            swiss: undefined,
        }));
    };

    const handleSwissGroupPlayerSwap = (
        groupIndexA: number,
        studentIdA: string,
        groupIndexB: number,
        studentIdB: string
    ) => {
        setData(prev => {
            if (!prev.swiss?.groups) return prev;
            const r = swapSwissPlayersBetweenGroups(prev.swiss, groupIndexA, studentIdA, groupIndexB, studentIdB);
            if (!r.ok) {
                alert(r.message);
                return prev;
            }
            return { ...prev, swiss: r.data };
        });
    };

    return (
        <div className="tournament-view">
            <div className="view-header-actions">
                <div className="view-toggle">
                    <button className={`toggle-btn ${activeTab === 'relay' ? 'active' : ''}`} onClick={() => setActiveTab('relay')}>팀 대항전</button>
                    <button className={`toggle-btn ${activeTab === 'bracket' ? 'active' : ''}`} onClick={() => setActiveTab('bracket')}>토너먼트</button>
                    <button className={`toggle-btn ${activeTab === 'swiss' ? 'active' : ''}`} onClick={() => setActiveTab('swiss')}>스위스리그</button>
                    <button className={`toggle-btn ${activeTab === 'hybrid' ? 'active' : ''}`} onClick={() => setActiveTab('hybrid')}>예선+본선</button>
                    <button className={`toggle-btn ${activeTab === 'fullleague' ? 'active' : ''}`} onClick={() => setActiveTab('fullleague')}>풀리그</button>
                    <button className={`toggle-btn ${activeTab === 'doubleelim' ? 'active' : ''}`} onClick={() => setActiveTab('doubleelim')}>더블엘리미네이션</button>
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
                        setSettings={setSettings}
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
                        canResetSwiss={canResetSwiss}
                        onResetSwiss={handleResetSwiss}
                        onSetWinner={handleSetSwissWinner}
                        onGenerateNextRound={handleGenerateNextRoundSwiss}
                        onCancelLastRound={handleCancelLastRoundSwiss}
                        onRematchRound={handleRematchSwiss}
                        onOpenPrizeModal={() => setIsSwissPrizeModalOpen(true)}
                        onPlayerSwap={setData}
                        onOpenPlayerManagement={() => setIsPlayerManagementModalOpen(true)}
                        onSwapGroupPlayers={handleSwissGroupPlayerSwap}
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
                {activeTab === 'fullleague' && (
                    <TournamentFullLeagueView
                        data={data}
                        students={students}
                        setData={setData}
                        onOpenPlayerManagement={() => setIsPlayerManagementModalOpen(true)}
                        settings={settings}
                        onBulkAddTransaction={onBulkAddTransaction}
                    />
                )}
                {activeTab === 'doubleelim' && (
                    <TournamentDoubleElimView
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
                    participantIds={getTabParticipantIds(activeTab)}
                    onUpdateParticipants={handleUpdateParticipants}
                    onAssignTeams={handleAssignTeams}
                    currentView={activeTab}
                    tournamentSettings={settings}
                    onStartSwiss={handleStartSwiss}
                    onInitMission={handleInitMissionBaduk}
                    onInitHybrid={handleInitHybrid}
                    onInitFullLeague={handleInitFullLeague}
                    onInitDoubleElim={handleInitDoubleElim}
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
