import React, { useEffect, useMemo, useState } from 'react';
import type {
    Student,
    TournamentData,
    TournamentSettings,
    SwissPlayer,
    SwissMatch,
    TournamentAwardGrant,
    TournamentAwardRequest,
    TournamentSwissGroupPrizes,
} from '../../types';
import { parseRank, generateId } from '../../utils';
import { DEFAULT_BYE_PRIORITY } from '../../utils/byePlacement';
import { buildSingleElimRounds } from '../../utils/elimBracket';
import { asArray, normalizeHybridPreliminaryGroups } from '../../utils/tournament/compatibility';
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
    advanceCount: number;
    onSetWinner: (matchId: string, winnerId: string) => void;
    onOpenPrize?: (groupIndex: number) => void;
}

const PreliminaryGroupView: React.FC<PreliminaryGroupViewProps> = ({
    group,
    groupIndex,
    players,
    advanceCount,
    onSetWinner,
    onOpenPrize,
}) => {
    const matches = asArray<SwissMatch>(group);
    const safePlayers = asArray<SwissPlayer>(players);
    const getPlayer = (id: string) => safePlayers.find(p => p.studentId === id);
    const isGroupComplete = matches.length > 0 && matches.every(match => !!match.winnerId);

    const groupPlayers = useMemo(() => {
        const playerIds = new Set(
            matches.flatMap(m => asArray<string | 'BYE'>(m?.players)).filter(id => id && id !== 'BYE')
        );
        return safePlayers
            .filter(p => playerIds.has(p.studentId))
            .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'ko'));
    }, [matches, safePlayers]);

    return (
        <div className="hybrid-group-panel">
            <div className="hybrid-preliminary-header">
                <div className="hybrid-group-heading">
                    <h3>{groupIndex + 1}조</h3>
                    <span className="hybrid-group-meta">
                        {groupPlayers.length}명 · 상위 {advanceCount}명 진출
                    </span>
                </div>
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

            <section className="hybrid-player-roster" aria-label={`${groupIndex + 1}조 선수`}>
                <div className="hybrid-section-label">조별 선수</div>
                {groupPlayers.length === 0 ? (
                    <p className="hybrid-empty-hint">이 조에 등록된 선수가 없습니다.</p>
                ) : (
                    <ul className="hybrid-player-row">
                        {groupPlayers.map((player, index) => {
                            const qualifies = index < advanceCount;
                            return (
                                <li
                                    key={player.studentId}
                                    className={`hybrid-player-chip${qualifies ? ' is-qualifying' : ''}`}
                                >
                                    <span className="hybrid-player-rank">{index + 1}</span>
                                    <span className="hybrid-player-name">{player.name}</span>
                                    <span className="hybrid-player-score">{player.score}승</span>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>

            <section className="hybrid-match-board" aria-label={`${groupIndex + 1}조 대진`}>
                <div className="hybrid-section-label">조별 대진</div>
                {matches.length === 0 ? (
                    <p className="hybrid-empty-hint">대진이 없습니다.</p>
                ) : (
                    <ul className="hybrid-match-row">
                        {matches.map(match => {
                            const matchPlayers = asArray<string | 'BYE'>(match.players);
                            const player1 = getPlayer(matchPlayers[0] as string);
                            const player2 = getPlayer(matchPlayers[1] as string);
                            return (
                                <li key={match.id} className="hybrid-match-card">
                                    <button
                                        type="button"
                                        className={`hybrid-match-side${match.winnerId === player1?.studentId ? ' is-winner' : ''}${match.winnerId && match.winnerId !== player1?.studentId ? ' is-loser' : ''}`}
                                        onClick={() => player1 && onSetWinner(match.id, player1.studentId)}
                                        disabled={!player1}
                                    >
                                        <span className="hybrid-match-name">{player1?.name || 'BYE'}</span>
                                        {match.winnerId === player1?.studentId && <span className="winner-label">승</span>}
                                    </button>
                                    <span className="hybrid-match-vs" aria-hidden>VS</span>
                                    <button
                                        type="button"
                                        className={`hybrid-match-side${match.winnerId === player2?.studentId ? ' is-winner' : ''}${match.winnerId && match.winnerId !== player2?.studentId ? ' is-loser' : ''}`}
                                        onClick={() => player2 && onSetWinner(match.id, player2.studentId)}
                                        disabled={!player2}
                                    >
                                        <span className="hybrid-match-name">{player2?.name || 'BYE'}</span>
                                        {match.winnerId === player2?.studentId && <span className="winner-label">승</span>}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>
        </div>
    );
};

export const TournamentHybridView = (props: TournamentHybridViewProps) => {
    const { students, data, setData, settings, onOpenPlayerManagement, onAwardBatch, awardEventKey } = props;
    const { hybridParticipantIds } = data;
    const { hybridMode, hybridAdvanceCount, hybridGroupCount } = settings;

    const [confirmation, setConfirmation] = useState<{ message: React.ReactNode, actions: any[] } | null>(null);
    const [groupTab, setGroupTab] = useState(0);
    const [phaseTab, setPhaseTab] = useState<'prelim' | 'final'>('prelim');
    const [prelimPrizeGroupIndex, setPrelimPrizeGroupIndex] = useState<number | null>(null);

    const preliminaryGroups = useMemo(
        () => (data.hybrid ? normalizeHybridPreliminaryGroups(data.hybrid.preliminaryGroups) as SwissMatch[][] : []),
        [data.hybrid]
    );
    const hybridPlayers = useMemo(
        () => (data.hybrid ? asArray<SwissPlayer>(data.hybrid.players) : []),
        [data.hybrid]
    );
    const advanceCount = getHybridAdvanceCountPerGroup(hybridAdvanceCount);
    const hasBracket = !!data.hybrid?.bracket;

    useEffect(() => {
        if (!preliminaryGroups.length) {
            setGroupTab(0);
            return;
        }
        setGroupTab(current => Math.min(current, preliminaryGroups.length - 1));
    }, [preliminaryGroups.length]);

    useEffect(() => {
        if (hasBracket) setPhaseTab('final');
        else setPhaseTab('prelim');
    }, [hasBracket]);

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
        const nextPreliminaryGroups = groups.map(group => createRoundRobinMatches(group, generateId));

        setGroupTab(0);
        setPhaseTab('prelim');
        setData(prev => ({
            ...prev,
            hybrid: {
                players: swissPlayers,
                preliminaryGroups: nextPreliminaryGroups,
                bracket: null,
            },
            awardSessionIds: { ...prev.awardSessionIds, hybrid: generateId() },
        }));
    };

    const handleSetPreliminaryWinner = (matchId: string, winnerId: string) => {
        setData(prev => {
            if (!prev.hybrid) return prev;
            const newData = JSON.parse(JSON.stringify(prev));
            const groups = normalizeHybridPreliminaryGroups(newData.hybrid.preliminaryGroups) as SwissMatch[][];
            newData.hybrid.preliminaryGroups = groups;
            let matchFound = false;

            for (const group of groups) {
                const match = asArray<SwissMatch>(group).find((m: SwissMatch) => m.id === matchId);
                if (match) {
                    match.winnerId = match.winnerId === winnerId ? null : winnerId;
                    matchFound = true;
                    break;
                }
            }

            if (matchFound) {
                asArray<SwissPlayer>(newData.hybrid.players).forEach((p: SwissPlayer) => {
                    p.score = 0;
                });
                groups.flat().forEach((m: SwissMatch) => {
                    if (m.winnerId) {
                        const winner = asArray<SwissPlayer>(newData.hybrid.players).find(
                            (p: SwissPlayer) => p.studentId === m.winnerId
                        );
                        if (winner) winner.score++;
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

        setPhaseTab('final');
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
    };

    const handleBracketDataUpdate = (updateAction: React.SetStateAction<TournamentData>) => {
        setData(globalPrev => {
            const fakePrev = { ...globalPrev, bracket: globalPrev.hybrid?.bracket || null };
            const updateFn = typeof updateAction === 'function' ? updateAction : () => updateAction;
            const nextState = updateFn(fakePrev);
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

    const allMatchesPlayed =
        preliminaryGroups.length > 0 && preliminaryGroups.flat().every(m => m.winnerId);
    const activeGroupTab = Math.min(groupTab, Math.max(0, preliminaryGroups.length - 1));
    const showPrelim = !hasBracket || phaseTab === 'prelim';

    const prelimContent = (
        <div className="tournament-group-tabs hybrid-group-tabs">
            <div className="group-tab-buttons" role="tablist" aria-label="예선 조 선택">
                {preliminaryGroups.map((group, i) => {
                    const done = group.length > 0 && group.every(match => !!match.winnerId);
                    return (
                        <button
                            key={i}
                            type="button"
                            role="tab"
                            aria-selected={activeGroupTab === i}
                            className={`tab-btn${activeGroupTab === i ? ' active' : ''}${done ? ' is-complete' : ''}`}
                            onClick={() => setGroupTab(i)}
                        >
                            {i + 1}조
                            {done ? <span className="hybrid-tab-done">완료</span> : null}
                        </button>
                    );
                })}
            </div>
            <div className="group-tab-content hybrid-group-tab-content" role="tabpanel">
                <PreliminaryGroupView
                    group={preliminaryGroups[activeGroupTab] || []}
                    groupIndex={activeGroupTab}
                    players={hybridPlayers}
                    advanceCount={advanceCount}
                    onSetWinner={handleSetPreliminaryWinner}
                    onOpenPrize={setPrelimPrizeGroupIndex}
                />
            </div>
        </div>
    );

    return (
        <div className="tournament-swiss-view tournament-hybrid-view">
            <div className="swiss-controls hybrid-controls">
                <button className="btn" onClick={onOpenPlayerManagement}>선수 관리</button>
                {!hasBracket && (
                    <button className="btn primary" onClick={handleAdvanceToBracket} disabled={!allMatchesPlayed}>
                        본선 대진표 생성
                    </button>
                )}
                <button className="btn danger" onClick={handleReset}>대진표 초기화</button>
            </div>

            {hasBracket && (
                <div className="group-tab-buttons hybrid-phase-tabs" role="tablist" aria-label="예선·본선 전환">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={phaseTab === 'prelim'}
                        className={`tab-btn${phaseTab === 'prelim' ? ' active' : ''}`}
                        onClick={() => setPhaseTab('prelim')}
                    >
                        예선
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={phaseTab === 'final'}
                        className={`tab-btn${phaseTab === 'final' ? ' active' : ''}`}
                        onClick={() => setPhaseTab('final')}
                    >
                        본선
                    </button>
                </div>
            )}

            {showPrelim ? (
                <>
                    <p className="hybrid-help-text">
                        조 탭에서 선수와 대진을 확인하세요. 각 조 상위 {advanceCount}명이 본선에 진출합니다.
                    </p>
                    {prelimContent}
                </>
            ) : (
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
            )}

            {prelimPrizeGroupIndex !== null && data.hybrid && (
                <HybridPrelimPrizeModal
                    isOpen
                    onClose={() => setPrelimPrizeGroupIndex(null)}
                    settings={settings}
                    groupIndex={prelimPrizeGroupIndex}
                    groupLabel={`${prelimPrizeGroupIndex + 1}조`}
                    groupMatches={preliminaryGroups[prelimPrizeGroupIndex] || []}
                    allPlayers={hybridPlayers}
                    onAward={handlePrelimPrizeAward}
                />
            )}

            {confirmation && <ConfirmationModal {...confirmation} onClose={() => setConfirmation(null)} />}
        </div>
    );
};
