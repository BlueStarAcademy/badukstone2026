
import React, { useState } from 'react';
import type {
    Student,
    TournamentData,
    TournamentSettings,
    SwissPlayer,
    SwissGroupData,
    MissionBadukPlayer,
    TournamentPlayer,
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
import { DEFAULT_BYE_PRIORITY } from '../../utils/byePlacement';
import { buildDoubleElim } from '../../utils/doubleElimBracket';
import { defaultSwissGroupPrize, parseSwissGroupSizes, forEachSwissStylePayout } from '../../utils/tournamentPrizes';
import { swapSwissPlayersBetweenGroups } from '../../utils/swissGroupSwap';
import {
    cancelLastSwissRound,
    createFullLeague,
    createRoundRobinMatches,
    createSwissFirstRound,
    createSwissPairings,
    distributeHybridGroups,
    getHybridAdvanceCountPerGroup,
    recomputeSwissStats,
    resolveParticipants,
    toSwissPlayer,
} from '../../utils/tournament';

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
        const participants = resolveParticipants(ids, students);
        if (participants.length < 2) {
            alert('풀리그를 시작하려면 최소 2명이 필요합니다.');
            return;
        }
        setData(prev => ({
            ...prev,
            fullLeagueParticipantIds: ids,
            fullLeague: createFullLeague(participants, generateId),
        }));
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
                const groupPlayers = slice.map(p => toSwissPlayer({ id: p.id, name: p.name, rank: p.rank }));
                const firstRound = createSwissFirstRound(
                    groupPlayers,
                    settings.byePriority ?? DEFAULT_BYE_PRIORITY,
                    generateId
                );
                groups.push({
                    id: generateId(),
                    label: `${idx + 1}조 (${size}명)`,
                    players: recomputeSwissStats(groupPlayers, [firstRound]),
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

        const swissPlayers = participants.map(p => toSwissPlayer({ id: p.id, name: p.name, rank: p.rank }));

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

        const firstRoundMatches = createSwissFirstRound(
            sortedPlayers,
            settings.byePriority ?? DEFAULT_BYE_PRIORITY,
            generateId
        );

        setData(prev => ({
            ...prev,
            swissParticipantIds: participantIdsToUse,
            swiss: {
                status: 'in_progress',
                players: recomputeSwissStats(swissPlayers, [firstRoundMatches]),
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
        
        const numGroups = Math.min(
            participants.length,
            Math.max(1, settings.hybridGroupCount || Math.ceil(participants.length / 5))
        );
        const advancePerGroup = getHybridAdvanceCountPerGroup(settings.hybridAdvanceCount);
        if (participants.length < advancePerGroup * numGroups) {
            alert(`각 조 상위 ${advancePerGroup}명 진출에는 최소 ${advancePerGroup * numGroups}명이 필요합니다.`);
            return;
        }

        let sortedParticipants: Student[];
        if (settings.hybridMode === 'rank') {
            sortedParticipants = [...participants].sort((a, b) => parseRank(b.rank) - parseRank(a.rank));
        } else {
            sortedParticipants = [...participants].sort(() => 0.5 - Math.random());
        }

        const groups = distributeHybridGroups(sortedParticipants, numGroups);
        const swissPlayers = participants.map(p => toSwissPlayer({ id: p.id, name: p.name, rank: p.rank }));
        const preliminaryGroups = groups.map(group =>
            createRoundRobinMatches(
                group.map(player => ({ id: player.id, name: player.name, rank: player.rank })),
                generateId
            )
        );
        
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
                const recomputed = recomputeSwissStats(targetPlayers, targetRounds);
                if (groupIndex !== undefined && newSwiss.groups?.[groupIndex]) {
                    newSwiss.groups[groupIndex].players = recomputed;
                    newSwiss.players = newSwiss.groups.flatMap((group: SwissGroupData) => group.players);
                } else {
                    newSwiss.players = recomputed;
                }
                const roundLimit = Math.max(1, Math.floor(settings.swissRounds || 1));
                const allConfiguredRoundsComplete = newSwiss.groups?.length
                    ? newSwiss.groups.every(
                        (group: SwissGroupData) =>
                            group.rounds.length >= roundLimit &&
                            group.rounds[group.rounds.length - 1]?.every(result => result.winnerId)
                    )
                    : targetRounds.length >= roundLimit &&
                        targetRounds[targetRounds.length - 1]?.every((result: { winnerId: string | null }) => result.winnerId);
                newSwiss.status = allConfiguredRoundsComplete ? 'finished' : 'in_progress';
            }
            return { ...prev, swiss: newSwiss };
        });
    };

    const handleGenerateNextRoundSwiss = (groupIndex?: number) => {
        setData(prev => {
            if (!prev.swiss) return prev;
            const newSwiss = JSON.parse(JSON.stringify(prev.swiss));
            const roundLimit = Math.max(1, Math.floor(settings.swissRounds || 1));
            if (groupIndex !== undefined && newSwiss.groups?.[groupIndex]) {
                const g = newSwiss.groups[groupIndex];
                if (g.rounds.length >= roundLimit) return prev;
                const nextRoundMatches = createSwissPairings(
                    g.players,
                    g.rounds,
                    settings.byePriority ?? DEFAULT_BYE_PRIORITY,
                    generateId
                );
                g.rounds.push(nextRoundMatches);
                g.players = recomputeSwissStats(g.players, g.rounds);
                newSwiss.players = newSwiss.groups.flatMap((group: SwissGroupData) => group.players);
            } else {
                if (newSwiss.rounds.length >= roundLimit) return prev;
                const nextRoundMatches = createSwissPairings(
                    newSwiss.players,
                    newSwiss.rounds,
                    settings.byePriority ?? DEFAULT_BYE_PRIORITY,
                    generateId
                );
                newSwiss.rounds.push(nextRoundMatches);
                newSwiss.players = recomputeSwissStats(newSwiss.players, newSwiss.rounds);
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
            const targetPlayers: SwissPlayer[] =
                groupIndex !== undefined && newSwiss.groups?.[groupIndex]
                    ? newSwiss.groups[groupIndex].players
                    : newSwiss.players;

            if (targetRounds.length <= 1) return prev;
            const cancelled = cancelLastSwissRound(targetPlayers, targetRounds);
            targetRounds.splice(0, targetRounds.length, ...cancelled.rounds);
            if (groupIndex !== undefined && newSwiss.groups?.[groupIndex]) {
                newSwiss.groups[groupIndex].players = cancelled.players;
                newSwiss.players = newSwiss.groups.flatMap((group: SwissGroupData) => group.players);
            } else {
                newSwiss.players = cancelled.players;
            }
            newSwiss.status = 'in_progress';

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
            const targetPlayers: SwissPlayer[] =
                groupIndex !== undefined && newSwiss.groups?.[groupIndex]
                    ? newSwiss.groups[groupIndex].players
                    : newSwiss.players;

            if (targetRounds.length === 0) return prev;
            const priorRounds = targetRounds.slice(0, -1);
            const priorPlayers = recomputeSwissStats(targetPlayers, priorRounds);
            const nextRoundMatches = createSwissPairings(
                priorPlayers,
                priorRounds,
                settings.byePriority ?? DEFAULT_BYE_PRIORITY,
                generateId
            );
            targetRounds.pop();
            targetRounds.push(nextRoundMatches);
            const recomputed = recomputeSwissStats(priorPlayers, targetRounds);
            if (groupIndex !== undefined && newSwiss.groups?.[groupIndex]) {
                newSwiss.groups[groupIndex].players = recomputed;
                newSwiss.players = newSwiss.groups.flatMap((group: SwissGroupData) => group.players);
            } else {
                newSwiss.players = recomputed;
            }

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
            if ('message' in r) {
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
                        maxRounds={settings.swissRounds}
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
