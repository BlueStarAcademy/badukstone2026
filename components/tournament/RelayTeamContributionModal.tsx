import React, { useMemo, useState } from 'react';
import type { Team, TournamentAwardRequest, TournamentPlayer, TournamentSettings } from '../../types';
import { ModalShell } from '../ui/ModalShell';
import { TournamentAwardModal } from './TournamentAwardModal';
import {
    buildRelayContributionEntries,
    findRelayMvp,
    type RelayContributionEntry,
} from '../../utils/tournament/relayScoring';
import { getRelayPrizeRow } from '../../utils/tournamentPrizes';

type TeamAwardTarget = { teamName: 'A' | 'B'; teamType: 'winner' | 'loser' };
type IndividualAwardTarget = {
    player: TournamentPlayer;
    label: string;
    defaultReason: string;
    awardKind: 'mvp' | 'player';
};

interface RelayTeamContributionModalProps {
    isOpen: boolean;
    onClose: () => void;
    teams: Team[];
    settings: TournamentSettings;
    winner: 'A' | 'B' | 'Draw' | null;
    awardEventKey: string;
    onAwardBatch: (request: TournamentAwardRequest) => boolean;
    isAwarded: (eventKey: string) => boolean;
}

const formatScore = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

const ContributionTable = ({
    title,
    entries,
    awardEventKey,
    isAwarded,
    onAwardPlayer,
}: {
    title: string;
    entries: RelayContributionEntry[];
    awardEventKey: string;
    isAwarded: (eventKey: string) => boolean;
    onAwardPlayer: (entry: RelayContributionEntry) => void;
}) => (
    <section className="relay-contribution-section">
        <h4>{title}</h4>
        <div className="relay-contribution-table-wrap">
            <table className="relay-contribution-table">
                <thead>
                    <tr>
                        <th>팀내</th>
                        <th>전체</th>
                        <th>선수</th>
                        <th>바둑</th>
                        <th>주사위</th>
                        <th>컬링</th>
                        <th>기여</th>
                        <th>시상</th>
                    </tr>
                </thead>
                <tbody>
                    {entries.map(entry => {
                        const playerAwardKey = `${awardEventKey}:player:${entry.player.studentId}`;
                        const awarded = isAwarded(playerAwardKey);
                        const { breakdown } = entry;
                        const game1Detail =
                            breakdown.game1 !== 0 || entry.player.game1Result !== null
                                ? `${formatScore(breakdown.game1Result)}+${formatScore(breakdown.game1Komi)}`
                                : '-';
                        return (
                            <tr key={`${entry.teamName}-${entry.player.studentId}`}>
                                <td>{entry.teamRank}</td>
                                <td>{entry.overallRank}</td>
                                <td>
                                    <strong>{entry.player.name}</strong>
                                    <small>{entry.player.rank}</small>
                                </td>
                                <td title={`결과 ${formatScore(breakdown.game1Result)} + 덤 ${formatScore(breakdown.game1Komi)}`}>
                                    {game1Detail}
                                </td>
                                <td>{breakdown.game2 ? formatScore(breakdown.game2) : '-'}</td>
                                <td>{breakdown.game3 ? formatScore(breakdown.game3) : '-'}</td>
                                <td className="relay-contribution-total">{formatScore(breakdown.total)}</td>
                                <td>
                                    <button
                                        type="button"
                                        className="btn-xs"
                                        disabled={awarded || breakdown.total === 0}
                                        onClick={() => onAwardPlayer(entry)}
                                    >
                                        {awarded ? '완료' : '개인'}
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    </section>
);

export const RelayTeamContributionModal: React.FC<RelayTeamContributionModalProps> = ({
    isOpen,
    onClose,
    teams,
    settings,
    winner,
    awardEventKey,
    onAwardBatch,
    isAwarded,
}) => {
    const [teamAwardTarget, setTeamAwardTarget] = useState<TeamAwardTarget | null>(null);
    const [individualTarget, setIndividualTarget] = useState<IndividualAwardTarget | null>(null);

    const entries = useMemo(
        () => (isOpen ? buildRelayContributionEntries(teams, settings) : []),
        [isOpen, teams, settings]
    );
    const mvp = useMemo(
        () => (isOpen ? findRelayMvp(teams, settings) : null),
        [isOpen, teams, settings]
    );

    const teamAEntries = entries.filter(entry => entry.teamName === 'A');
    const teamBEntries = entries.filter(entry => entry.teamName === 'B');

    const winnerAwardKey = `${awardEventKey}:winner`;
    const loserAwardKey = `${awardEventKey}:loser`;
    const mvpAwardKey = `${awardEventKey}:mvp`;
    const winnerAwarded = isAwarded(winnerAwardKey);
    const loserAwarded = isAwarded(loserAwardKey);
    const mvpAwarded = isAwarded(mvpAwardKey);

    const loserTeam: 'A' | 'B' | null =
        winner === 'A' ? 'B' : winner === 'B' ? 'A' : null;

    const handleTeamAward = (amount: number, reason: string) => {
        if (!teamAwardTarget) return;
        const targetTeam = teams.find(team => team.name === teamAwardTarget.teamName);
        if (!targetTeam) return;

        const applied = onAwardBatch({
            eventKey: teamAwardTarget.teamType === 'winner' ? winnerAwardKey : loserAwardKey,
            mode: 'relay',
            label: `팀 대항전 ${teamAwardTarget.teamType === 'winner' ? '승리팀' : '패배팀'} 시상`,
            grants: targetTeam.players.map(player => ({
                studentId: player.studentId,
                description: reason,
                amount,
            })),
            metadata: { phase: teamAwardTarget.teamType, team: teamAwardTarget.teamName },
        });
        if (applied) setTeamAwardTarget(null);
    };

    const handleIndividualAward = (amount: number, reason: string) => {
        if (!individualTarget) return;
        const eventKey =
            individualTarget.awardKind === 'mvp'
                ? mvpAwardKey
                : `${awardEventKey}:player:${individualTarget.player.studentId}`;
        const applied = onAwardBatch({
            eventKey,
            mode: 'relay',
            label: individualTarget.label,
            grants: [{
                studentId: individualTarget.player.studentId,
                description: reason,
                amount,
            }],
            metadata: { phase: 'individual', studentId: individualTarget.player.studentId },
        });
        if (applied) setIndividualTarget(null);
    };

    const openPlayerAward = (entry: RelayContributionEntry) => {
        setIndividualTarget({
            player: entry.player,
            label: `팀 대항전 개인 시상 (${entry.player.name})`,
            defaultReason: '팀 대항전 개인 기여 보상',
            awardKind: 'player',
        });
    };

    if (!isOpen) return null;

    return (
        <>
            <ModalShell
                title="팀 기여도"
                size="lg"
                onClose={onClose}
                footer={<button type="button" className="btn" onClick={onClose}>닫기</button>}
            >
                <div className="relay-contribution-modal">
                    {mvp && (
                        <div className="relay-contribution-mvp">
                            <div>
                                <span className="relay-contribution-kicker">TOURNAMENT MVP</span>
                                <p className="relay-contribution-mvp-name">
                                    {mvp.name} <small>({mvp.rank})</small>
                                </p>
                            </div>
                            <button
                                type="button"
                                className="btn primary"
                                disabled={mvpAwarded}
                                onClick={() =>
                                    setIndividualTarget({
                                        player: mvp,
                                        label: '팀 대항전 MVP 시상',
                                        defaultReason: '대회 MVP 보상',
                                        awardKind: 'mvp',
                                    })
                                }
                            >
                                {mvpAwarded ? 'MVP 시상 완료' : 'MVP 시상'}
                            </button>
                        </div>
                    )}

                    <div className="relay-contribution-award-row">
                        {winner === 'A' || winner === 'B' ? (
                            <>
                                <button
                                    type="button"
                                    className="btn"
                                    disabled={winnerAwarded}
                                    onClick={() => setTeamAwardTarget({ teamName: winner, teamType: 'winner' })}
                                >
                                    {winnerAwarded ? '✓ 승리팀 시상 완료' : `${winner}팀 승리팀 시상`}
                                </button>
                                {loserTeam && (
                                    <button
                                        type="button"
                                        className="btn"
                                        disabled={loserAwarded}
                                        onClick={() => setTeamAwardTarget({ teamName: loserTeam, teamType: 'loser' })}
                                    >
                                        {loserAwarded ? '✓ 패배팀 시상 완료' : `${loserTeam}팀 패배팀 시상`}
                                    </button>
                                )}
                            </>
                        ) : winner === 'Draw' ? (
                            <p className="award-disabled-reason">
                                동점 상태에서는 승리팀/패배팀 시상을 진행할 수 없습니다. 보너스 또는 감점을 확인하세요.
                            </p>
                        ) : (
                            <p className="award-disabled-reason">모든 경기 결과가 입력되면 팀 시상을 진행할 수 있습니다.</p>
                        )}
                    </div>

                    <ContributionTable
                        title="A팀 기여도"
                        entries={teamAEntries}
                        awardEventKey={awardEventKey}
                        isAwarded={isAwarded}
                        onAwardPlayer={openPlayerAward}
                    />
                    <ContributionTable
                        title="B팀 기여도"
                        entries={teamBEntries}
                        awardEventKey={awardEventKey}
                        isAwarded={isAwarded}
                        onAwardPlayer={openPlayerAward}
                    />
                </div>
            </ModalShell>

            {teamAwardTarget && (
                <TournamentAwardModal
                    isOpen
                    onClose={() => setTeamAwardTarget(null)}
                    teamName={teamAwardTarget.teamName}
                    teamType={teamAwardTarget.teamType}
                    onAward={handleTeamAward}
                    defaultStoneAmount={
                        teamAwardTarget.teamType === 'winner'
                            ? getRelayPrizeRow(settings, teamAwardTarget.teamName === 'A' ? 0 : 1).winPrize
                            : getRelayPrizeRow(settings, teamAwardTarget.teamName === 'A' ? 0 : 1).losePrize
                    }
                />
            )}

            {individualTarget && (
                <TournamentAwardModal
                    isOpen
                    onClose={() => setIndividualTarget(null)}
                    teamName={individualTarget.player.name}
                    teamType="winner"
                    onAward={handleIndividualAward}
                    defaultStoneAmount={getRelayPrizeRow(settings, 0).participantPrize}
                    defaultReason={individualTarget.defaultReason}
                />
            )}
        </>
    );
};
