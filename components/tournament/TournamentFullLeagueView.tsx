
import React, { useState } from 'react';
import type { Student, TournamentAwardRequest, TournamentData, TournamentSettings } from '../../types';
import { generateId, parseRank } from '../../utils';
import {
    createFullLeague,
    resolveParticipants,
    setFullLeagueWinner,
    sortFullLeaguePlayers,
} from '../../utils/tournament';
import { TournamentPrizeModal } from './TournamentPrizeModal';
import { ConfirmationModal } from '../modals/ConfirmationModal';
import {
    buildBracketStyleGrants,
    getBracketPaidRankCount,
    type BracketPrizePayout,
} from '../../utils/tournamentPrizes';

interface TournamentFullLeagueViewProps {
    data: TournamentData;
    students: Student[];
    setData: React.Dispatch<React.SetStateAction<TournamentData>>;
    onOpenPlayerManagement: () => void;
    settings: TournamentSettings;
    onAwardBatch: (request: TournamentAwardRequest) => boolean;
    awardEventKey: string;
    onInitFullLeague?: (mode: 'random' | 'ranked', ids: string[]) => void;
}

export const TournamentFullLeagueView = (props: TournamentFullLeagueViewProps) => {
    const {
        data,
        students,
        setData,
        onOpenPlayerManagement,
        settings,
        onAwardBatch,
        awardEventKey,
        onInitFullLeague,
    } = props;
    const fullLeague = data.fullLeague;
    const participantIds = data.fullLeagueParticipantIds || [];
    const [isPrizeModalOpen, setIsPrizeModalOpen] = useState(false);
    const [resetConfirmationOpen, setResetConfirmationOpen] = useState(false);
    const [assignmentMode, setAssignmentMode] = useState<'random' | 'ranked'>('ranked');

    const canResetFullLeague = participantIds.length > 0 || !!fullLeague;

    const handleStartFullLeague = (mode: 'random' | 'ranked', ids: string[]) => {
        if (onInitFullLeague) {
            onInitFullLeague(mode, ids);
            return;
        }
        const participants = resolveParticipants(ids, students);
        if (participants.length < 2) {
            alert('풀리그를 시작하려면 최소 2명이 필요합니다.');
            return;
        }
        const ordered =
            mode === 'ranked'
                ? [...participants].sort((a, b) => parseRank(b.rank) - parseRank(a.rank))
                : [...participants].sort(() => 0.5 - Math.random());
        setData(prev => ({
            ...prev,
            fullLeagueParticipantIds: ordered.map(p => p.id),
            fullLeague: createFullLeague(ordered, generateId),
            awardSessionIds: { ...prev.awardSessionIds, fullleague: generateId() },
        }));
    };

    const handleSetWinner = (matchId: string, clickedPlayerId: string) => {
        if (!fullLeague) return;
        setData(prev => {
            if (!prev.fullLeague) return prev;
            return { ...prev, fullLeague: setFullLeagueWinner(prev.fullLeague, matchId, clickedPlayerId) };
        });
    };

    const handleReset = () => {
        setData(prev => ({ ...prev, fullLeague: undefined }));
        setResetConfirmationOpen(false);
    };

    if (!fullLeague || fullLeague.players.length === 0) {
        return (
            <div className="tournament-fullleague-view tournament-empty-state">
                <span className="tournament-empty-kicker">ROUND ROBIN SETUP</span>
                <h3>풀리그 준비</h3>
                <div className="tournament-empty-actions">
                    <button type="button" className="btn" onClick={onOpenPlayerManagement}>
                        선수 관리
                    </button>
                    <button
                        type="button"
                        className="btn danger"
                        onClick={() => setResetConfirmationOpen(true)}
                        disabled={!canResetFullLeague}
                    >
                        풀리그 초기화
                    </button>
                </div>
                <p>
                    풀리그(전체 라운드로빈) 대진이 없습니다.
                    {participantIds.length >= 2
                        ? ' 저장된 참가자로 바로 시작할 수 있습니다.'
                        : " '선수 관리'에서 참가자를 선택하고 시작하세요."}
                </p>
                <div className="tournament-empty-setup">
                    <div className="tournament-player-mgmt-assign">
                        <label htmlFor="fullleague-empty-assign">배정/시드</label>
                        <select
                            id="fullleague-empty-assign"
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
                        onClick={() => handleStartFullLeague(assignmentMode, participantIds)}
                        disabled={participantIds.length < 2}
                    >
                        풀리그 시작 ({participantIds.length}명)
                    </button>
                </div>
                {resetConfirmationOpen && (
                    <ConfirmationModal
                        message="풀리그 대진·결과를 초기화할까요? 참가자 목록은 유지됩니다."
                        onClose={() => setResetConfirmationOpen(false)}
                        actions={[
                            { text: '취소', onClick: () => setResetConfirmationOpen(false) },
                            { text: '초기화', className: 'danger', onClick: handleReset },
                        ]}
                    />
                )}
            </div>
        );
    }
    const sortedPlayers = sortFullLeaguePlayers(fullLeague);
    const isComplete = fullLeague.matches.length > 0 && fullLeague.matches.every(match => !!match.winnerId);

    const handleAwardPrizes = (prizes: BracketPrizePayout) => {
        if (!fullLeague || !isComplete) return;
        if (sortedPlayers.length === 0) return;

        const placementIds = sortedPlayers.map(p => p.studentId);
        const grants = buildBracketStyleGrants(
            placementIds,
            prizes,
            getBracketPaidRankCount(settings),
            '풀리그'
        );
        if (onAwardBatch({
            eventKey: awardEventKey,
            mode: 'fullleague',
            label: '풀리그 결과',
            grants,
            metadata: { phase: 'final' },
        })) setIsPrizeModalOpen(false);
    };

    return (
        <div className="tournament-fullleague-view">
            <div className="fullleague-controls">
                <button className="btn" onClick={onOpenPlayerManagement}>선수 관리</button>
                <button className="btn danger" onClick={() => setResetConfirmationOpen(true)}>풀리그 초기화</button>
            </div>
            <div className="fullleague-layout">
                <div className="fullleague-matches-container">
                    <h3 className="fullleague-section-title">경기 목록</h3>
                    <ul className="fullleague-match-list">
                        {fullLeague.matches.map(match => {
                            const p1 = fullLeague.players.find(p => p.studentId === match.player1Id);
                            const p2 = fullLeague.players.find(p => p.studentId === match.player2Id);
                            const name1 = p1?.name ?? '?';
                            const name2 = p2?.name ?? '?';
                            const winnerId = match.winnerId;
                            return (
                                <li key={match.id} className="fullleague-match">
                                    <div
                                        className={`fullleague-player ${winnerId === match.player1Id ? 'winner' : ''} clickable`}
                                        onClick={() => handleSetWinner(match.id, match.player1Id)}
                                    >
                                        {name1}
                                        {winnerId === match.player1Id && <span className="winner-label">승</span>}
                                    </div>
                                    <div className="fullleague-vs">VS</div>
                                    <div
                                        className={`fullleague-player ${winnerId === match.player2Id ? 'winner' : ''} clickable`}
                                        onClick={() => handleSetWinner(match.id, match.player2Id)}
                                    >
                                        {name2}
                                        {winnerId === match.player2Id && <span className="winner-label">승</span>}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>
                <div className="fullleague-standings-container">
                    <h3 className="fullleague-section-title">순위</h3>
                    <div className="fullleague-table-wrapper">
                        <table className="fullleague-standings-table">
                            <thead>
                                <tr>
                                    <th>순위</th>
                                    <th>이름</th>
                                    <th>승</th>
                                    <th>패</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedPlayers.map((p, i) => (
                                    <tr key={p.studentId} className={i < 3 ? `rank-${i + 1}` : ''}>
                                        <td>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</td>
                                        <td className="standings-player-name">{p.name}</td>
                                        <td>{p.wins}</td>
                                        <td>{p.losses}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="fullleague-standings-actions">
                        <button
                            type="button"
                            className="btn primary"
                            onClick={() => setIsPrizeModalOpen(true)}
                            disabled={!isComplete}
                            title={!isComplete ? '모든 경기 결과를 입력해야 시상할 수 있습니다.' : undefined}
                        >
                            순위 보상
                        </button>
                        {!isComplete && <p className="award-disabled-reason">모든 경기를 완료하면 순위 보상을 진행할 수 있습니다.</p>}
                    </div>
                </div>
            </div>
            <TournamentPrizeModal
                isOpen={isPrizeModalOpen}
                onClose={() => setIsPrizeModalOpen(false)}
                settings={settings}
                prizeKey="bracket"
                mode="fullleague"
                onAwardPrizes={handleAwardPrizes}
            />
            {resetConfirmationOpen && (
                <ConfirmationModal
                    message="풀리그 대진·결과를 초기화할까요? 참가자 목록은 유지됩니다."
                    onClose={() => setResetConfirmationOpen(false)}
                    actions={[
                        { text: '취소', onClick: () => setResetConfirmationOpen(false) },
                        { text: '초기화', className: 'danger', onClick: handleReset },
                    ]}
                />
            )}
        </div>
    );
};
