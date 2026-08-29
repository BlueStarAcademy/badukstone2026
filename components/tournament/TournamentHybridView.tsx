
import React, { useState, useMemo } from 'react';
import type {
    Student,
    TournamentData,
    TournamentSettings,
    SwissPlayer,
    SwissMatch,
    TournamentBracket,
    TournamentMatch,
    TournamentAwardGrant,
    TournamentAwardRequest,
    TournamentSwissGroupPrizes,
} from '../../types';
import { parseRank, generateId } from '../../utils';
import { DEFAULT_BYE_PRIORITY } from '../../utils/byePlacement';
import { buildSingleElimRounds } from '../../utils/elimBracket';
import { computeStandingsInPreliminaryGroup, forEachSwissStylePayout } from '../../utils/tournamentPrizes';
import {
    createRoundRobinMatches,
    distributeHybridGroups,
    getHybridAdvanceCountPerGroup,
    resolveParticipants,
    selectHybridQualifiersPerGroup,
    toSwissPlayer,
    toTournamentPlayer,
} from '../../utils/tournament';
import { TournamentBracketView } from './TournamentBracketView';
import { HybridPrelimPrizeModal } from './HybridPrelimPrizeModal';
import { ConfirmationModal } from '../modals/ConfirmationModal';

interface TournamentHybridViewProps {
    students: Student[];
    data: TournamentData;
    setData: React.Dispatch<React.SetStateAction<TournamentData>>;
    settings: TournamentSettings;
    onOpenPlayerManagement: () => void;
    onAwardBatch: (request: TournamentAwardRequest) => boolean;
    awardEventKey: string;
}

interface PreliminaryGroupViewProps {
    group: SwissMatch[];
    groupIndex: number;
    players: SwissPlayer[];
    onSetWinner: (matchId: string, winnerId: string) => void;
    onOpenPrize?: (groupIndex: number) => void;
}

const PreliminaryGroupView: React.FC<PreliminaryGroupViewProps> = ({ group, groupIndex, players, onSetWinner, onOpenPrize }) => {
    const getPlayer = (id: string) => players.find(p => p.studentId === id);
    const isGroupComplete = group.length > 0 && group.every(match => !!match.winnerId);

    const groupPlayers = useMemo(() => {
        const playerIds = new Set(group.flatMap(m => m.players));
        return players.filter(p => playerIds.has(p.studentId)).sort((a,b) => b.score - a.score);
    }, [group, players]);

    return (
        <div className="swiss-round hybrid-preliminary-group">
            <div className="hybrid-preliminary-header">
                <h3>{groupIndex + 1}조</h3>
                {onOpenPrize && (
                    <button
                        type="button"
                        className="btn-sm primary"
                        onClick={() => onOpenPrize(groupIndex)}
                        disabled={!isGroupComplete}
                        title={!isGroupComplete ? '이 조의 모든 경기 결과를 입력해야 시상할 수 있습니다.' : undefined}
                    >
                        이 조 예선 시상
                    </button>
                )}
            </div>
            <table className="swiss-standings-table hybrid-preliminary-table">
                <thead><tr><th>선수</th><th>승점</th></tr></thead>
                <tbody>
                    {groupPlayers.map(p => (
                        <tr key={p.studentId}>
                            <td>{p.name}</td>
                            <td>{p.score}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <ul className="swiss-match-list">
                {group.map(match => {
                    const player1 = getPlayer(match.players[0] as string);
                    const player2 = getPlayer(match.players[1] as string);
                    return (
                        <li key={match.id} className="swiss-match">
                            <div className={`swiss-player clickable ${match.winnerId === player1?.studentId ? 'winner' : ''} ${match.winnerId && match.winnerId !== player1?.studentId ? 'loser' : ''}`} onClick={() => player1 && onSetWinner(match.id, player1.studentId)}>
                                <span>{player1?.name}</span>
                                {match.winnerId === player1?.studentId && <span className="winner-label">승</span>}
                            </div>
                            <div className="swiss-vs">VS</div>
                            <div className={`swiss-player clickable ${match.winnerId === player2?.studentId ? 'winner' : ''} ${match.winnerId && match.winnerId !== player2?.studentId ? 'loser' : ''}`} onClick={() => player2 && onSetWinner(match.id, player2.studentId)}>
                                <span>{player2?.name}</span>
                                {match.winnerId === player2?.studentId && <span className="winner-label">승</span>}
                            </div>
                        </li>
                    )
                })}
            </ul>
        </div>
    );
};

export const TournamentHybridView = (props: TournamentHybridViewProps) => {
    const { students, data, setData, settings, onOpenPlayerManagement, onAwardBatch, awardEventKey } = props;
    const { hybridParticipantIds } = data;
    const { hybridMode, hybridAdvanceCount, hybridGroupCount } = settings;

    const [confirmation, setConfirmation] = useState<{ message: React.ReactNode, actions: any[] } | null>(null);
    const [groupTab, setGroupTab] = useState(0);
    const [prelimPrizeGroupIndex, setPrelimPrizeGroupIndex] = useState<number | null>(null);

    const handleGeneratePreliminaries = () => {
        const participants = resolveParticipants(hybridParticipantIds || [], students);
        const numGroups = Math.min(
            participants.length,
            Math.max(1, hybridGroupCount || Math.ceil(participants.length / 5))
        );
        const advancePerGroup = getHybridAdvanceCountPerGroup(hybridAdvanceCount);
        if (participants.length < advancePerGroup * numGroups) {
            alert(`각 조 상위 ${advancePerGroup}명 진출에는 최소 ${advancePerGroup * numGroups}명이 필요합니다.`);
            return;
        }

        let sortedParticipants = [...participants];
        if (hybridMode === 'rank') {
            sortedParticipants = [...participants].sort((a, b) => parseRank(b.rank) - parseRank(a.rank));
        } else {
            sortedParticipants = [...participants].sort(() => 0.5 - Math.random());
        }

        const groups = distributeHybridGroups(sortedParticipants, numGroups);
        const swissPlayers = participants.map(toSwissPlayer);
        const preliminaryGroups = groups.map(group => createRoundRobinMatches(group, generateId));
        
        setData(prev => ({
            ...prev,
            hybrid: {
                players: swissPlayers,
                preliminaryGroups,
                bracket: null,
            },
            awardSessionIds: { ...prev.awardSessionIds, hybrid: generateId() },
        }));
    };

    const handleSetPreliminaryWinner = (matchId: string, winnerId: string) => {
        setData(prev => {
            if (!prev.hybrid) return prev;
            const newData = JSON.parse(JSON.stringify(prev));
            let matchFound = false;

            for (const group of newData.hybrid.preliminaryGroups) {
                const match = group.find((m: SwissMatch) => m.id === matchId);
                if (match) {
                    const newWinnerId = match.winnerId === winnerId ? null : winnerId;
                    match.winnerId = newWinnerId;
                    matchFound = true;
                    break;
                }
            }
            
            if (matchFound) {
                newData.hybrid.players.forEach((p: SwissPlayer) => p.score = 0);
                newData.hybrid.preliminaryGroups.flat().forEach((m: SwissMatch) => {
                    if (m.winnerId) {
                        const winner = newData.hybrid.players.find((p: SwissPlayer) => p.studentId === m.winnerId);
                        if(winner) winner.score++;
                    }
                });
            }
            return newData;
        });
    };

    const handlePrelimPrizeAward = (prizes: TournamentSwissGroupPrizes) => {
        if (prelimPrizeGroupIndex === null || !data.hybrid) return;
        const gi = prelimPrizeGroupIndex;
        const group = data.hybrid.preliminaryGroups[gi];
        if (!group.length || group.some(match => !match.winnerId)) return;
        const sorted = computeStandingsInPreliminaryGroup(group, data.hybrid.players);
        const label = `예선 ${gi + 1}조`;
        const grants: TournamentAwardGrant[] = [];
        forEachSwissStylePayout(sorted, prizes, settings, label, (ids, desc, amt) =>
            ids.forEach(studentId => grants.push({ studentId, description: desc, amount: amt }))
        );
        if (onAwardBatch({
            eventKey: `${awardEventKey}:prelim:${gi}`,
            mode: 'hybrid',
            label: `예선+본선 ${gi + 1}조 예선`,
            grants,
            metadata: { phase: 'preliminary', groupIndex: gi },
        })) setPrelimPrizeGroupIndex(null);
    };

    const handleAdvanceToBracket = () => {
        if (!data.hybrid) return;

        const qualifiedPlayers = selectHybridQualifiersPerGroup(
            data.hybrid.players,
            data.hybrid.preliminaryGroups,
            getHybridAdvanceCountPerGroup(hybridAdvanceCount)
        );
        const tournamentPlayers = qualifiedPlayers.map(player =>
            toTournamentPlayer({
                id: player.studentId,
                name: player.name,
                rank: students.find(student => student.id === player.studentId)?.rank || 'N/A',
            })
        );

        const byePriority = settings.byePriority ?? DEFAULT_BYE_PRIORITY;
        const { rounds } = buildSingleElimRounds(tournamentPlayers, byePriority, true);

        setData(prev => ({
            ...prev,
            hybrid: {
                ...prev.hybrid!,
                bracket: { rounds, players: tournamentPlayers },
            }
        }));
    };

    const handleReset = () => {
        setConfirmation({
            message: "정말 예선 및 본선 대진표를 모두 초기화하시겠습니까?",
            actions: [
                { text: '취소', onClick: () => setConfirmation(null) },
                { text: '초기화', className: 'danger', onClick: () => {
                    setData(prev => ({ ...prev, hybrid: undefined }));
                    setConfirmation(null);
                }}
            ]
        });
    }

    // Intercept setData from child TournamentBracketView to update hybrid.bracket instead of root bracket
    const handleBracketDataUpdate = (updateAction: React.SetStateAction<TournamentData>) => {
        setData(globalPrev => {
            // Create a fake previous state where root.bracket is populated from hybrid.bracket
            // This satisfies TournamentBracketView logic which expects root.bracket
            const fakePrev = { ...globalPrev, bracket: globalPrev.hybrid?.bracket || null };
            
            // Apply the update
            const updateFn = typeof updateAction === 'function' ? updateAction : () => updateAction;
            const nextState = updateFn(fakePrev);
            
            // Put the updated bracket back into hybrid.bracket
            return {
                ...globalPrev,
                hybrid: {
                    ...globalPrev.hybrid!,
                    bracket: nextState.bracket
                }
            };
        });
    };

    if (!data.hybrid) {
        return (
             <div className="tournament-bracket-view tournament-empty-state">
                <span className="tournament-empty-kicker">HYBRID SETUP</span>
                <h3>예선 리그 준비</h3>
                <div className="tournament-empty-actions">
                    <button className="btn" onClick={onOpenPlayerManagement}>선수 관리</button>
                </div>
                <p>참가 선수를 선택하고 예선 리그를 생성하세요.</p>
                <div className="tournament-empty-actions">
                    <button className="btn primary" onClick={handleGeneratePreliminaries} disabled={(hybridParticipantIds || []).length < 2}>예선 리그 생성</button>
                </div>
            </div>
        );
    }
    
    if (data.hybrid && !data.hybrid.bracket) {
        const allMatchesPlayed = data.hybrid.preliminaryGroups.flat().every(m => m.winnerId);
        const totalParticipants = data.hybrid.players.length;
        const useGroupTabs = totalParticipants >= 16 && data.hybrid.preliminaryGroups.length >= 2;

        const activeGroupTab = Math.min(groupTab, data.hybrid.preliminaryGroups.length - 1);
        const content = useGroupTabs ? (
            <div className="tournament-group-tabs">
                <div className="group-tab-buttons">
                    {data.hybrid.preliminaryGroups.map((_, i) => (
                        <button
                            key={i}
                            className={`tab-btn ${activeGroupTab === i ? 'active' : ''}`}
                            onClick={() => setGroupTab(i)}
                        >{i + 1}조</button>
                    ))}
                </div>
                <div className="group-tab-content">
                    <PreliminaryGroupView
                        group={data.hybrid.preliminaryGroups[activeGroupTab]}
                        groupIndex={activeGroupTab}
                        players={data.hybrid.players}
                        onSetWinner={handleSetPreliminaryWinner}
                        onOpenPrize={setPrelimPrizeGroupIndex}
                    />
                </div>
            </div>
        ) : (
            <div className="hybrid-preliminary-grid">
                {data.hybrid.preliminaryGroups.map((group, i) => (
                    <PreliminaryGroupView
                        key={i}
                        group={group}
                        groupIndex={i}
                        players={data.hybrid!.players}
                        onSetWinner={handleSetPreliminaryWinner}
                        onOpenPrize={setPrelimPrizeGroupIndex}
                    />
                ))}
            </div>
        );

        return (
            <div className="tournament-swiss-view">
                 <div className="swiss-controls">
                    <button className="btn" onClick={onOpenPlayerManagement}>선수 관리</button>
                    <button className="btn primary" onClick={handleAdvanceToBracket} disabled={!allMatchesPlayed}>본선 대진표 생성</button>
                    <button className="btn danger" onClick={handleReset}>대진표 초기화</button>
                </div>
                <p>각 조의 모든 경기를 진행한 후, '본선 대진표 생성' 버튼을 누르세요. 각 조 상위 {getHybridAdvanceCountPerGroup(hybridAdvanceCount)}명이 진출합니다.</p>
                {content}
                {prelimPrizeGroupIndex !== null && data.hybrid && (
                    <HybridPrelimPrizeModal
                        isOpen
                        onClose={() => setPrelimPrizeGroupIndex(null)}
                        settings={settings}
                        groupIndex={prelimPrizeGroupIndex}
                        groupLabel={`${prelimPrizeGroupIndex + 1}조`}
                        groupMatches={data.hybrid.preliminaryGroups[prelimPrizeGroupIndex]}
                        allPlayers={data.hybrid.players}
                        onAward={handlePrelimPrizeAward}
                    />
                )}
            </div>
        );
    }

    if (data.hybrid && data.hybrid.bracket) {
         return (
            <TournamentBracketView
                data={{ ...data, bracket: data.hybrid.bracket }}
                students={students}
                setData={handleBracketDataUpdate}
                settings={settings}
                onAwardBatch={onAwardBatch}
                awardEventKey={`${awardEventKey}:final`}
                onOpenPlayerManagement={onOpenPlayerManagement}
                bracketPrizeKey="hybridBracket"
                prizeModalMode="hybridBracket"
            />
        );
    }

    return null;
};
