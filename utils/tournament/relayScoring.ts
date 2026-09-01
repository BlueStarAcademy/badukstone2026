import type { Team, TournamentPlayer, TournamentSettings } from '../../types';
import { parseRank } from '../../utils';

export interface PlayerGameBreakdown {
    game1: number;
    game1Result: number;
    game1Komi: number;
    game2: number;
    game3: number;
    total: number;
}

export interface RelayContributionEntry {
    player: TournamentPlayer;
    teamName: 'A' | 'B';
    matchIndex: number;
    breakdown: PlayerGameBreakdown;
    teamRank: number;
    overallRank: number;
}

export function computeAutoGame1Handicap(
    player: TournamentPlayer,
    opponent: TournamentPlayer | undefined,
    settings: TournamentSettings
): number {
    if (!opponent) return 0;

    const playerRank = parseRank(player.rank);
    const opponentRank = parseRank(opponent.rank);
    const ranksAreSame = playerRank === opponentRank;

    if (ranksAreSame) {
        if (player.game1Color === 'white') {
            return settings.game1SameRankHandicap;
        }
        return 0;
    }

    if (player.game1Color === 'white') {
        return 0;
    }

    const rankDiff = opponentRank - playerRank;
    return rankDiff > 1 ? rankDiff * settings.game1RankDiffHandicap : 0;
}

export function getEffectiveGame1Handicap(
    player: TournamentPlayer,
    opponent: TournamentPlayer | undefined,
    settings: TournamentSettings
): number {
    if (player.game1HandicapOverride) {
        return player.game1Handicap ?? 0;
    }
    return computeAutoGame1Handicap(player, opponent, settings);
}

export function syncAutoGame1Handicap(
    player: TournamentPlayer,
    opponent: TournamentPlayer | undefined,
    settings: TournamentSettings
): TournamentPlayer {
    if (player.game1HandicapOverride) return player;
    return {
        ...player,
        game1Handicap: computeAutoGame1Handicap(player, opponent, settings),
    };
}

export function calculatePlayerGameBreakdown(
    player: TournamentPlayer,
    opponent: TournamentPlayer | undefined,
    settings: TournamentSettings
): PlayerGameBreakdown {
    const game1Komi = getEffectiveGame1Handicap(player, opponent, settings);
    const game1Result = player.game1Result ?? 0;
    const game1 = player.game1Result !== null ? game1Result + game1Komi : 0;

    let game2 = 0;
    if (player.game2Score !== null) {
        game2 = player.game2Score * settings.game2StoneValue;
        if (player.game2LastStone) game2 += settings.game2LastStoneBonus;
    }

    let game3 = 0;
    if (player.game3Score !== null) {
        game3 = player.game3Score * settings.game3StoneValue;
    }

    return {
        game1,
        game1Result,
        game1Komi,
        game2,
        game3,
        total: game1 + game2 + game3,
    };
}

export interface RelayTeamScoreBreakdown {
    totalScore: number;
    game1Score: number;
    game2Score: number;
    game3Score: number;
    penaltyDeduction: number;
    bonusPoints: number;
}

export function calculateRelayTeamScores(
    team: Team,
    opponentTeam: Team | undefined,
    settings: TournamentSettings
): RelayTeamScoreBreakdown {
    let game1Score = 0;
    let game2Score = 0;
    let game3Score = 0;

    team.players.forEach((player, index) => {
        const opponent = opponentTeam?.players[index];
        const breakdown = calculatePlayerGameBreakdown(player, opponent, settings);
        game1Score += breakdown.game1;
        game2Score += breakdown.game2;
        game3Score += breakdown.game3;
    });

    const penaltyDeduction = (team.mannerPenalties || 0) * (settings.relayMannerPenalty || 0);
    const bonusPoints = team.bonusScore || 0;
    const totalScore = game1Score + game2Score + game3Score - penaltyDeduction + bonusPoints;

    return { totalScore, game1Score, game2Score, game3Score, penaltyDeduction, bonusPoints };
}

export function buildRelayContributionEntries(
    teams: Team[],
    settings: TournamentSettings
): RelayContributionEntry[] {
    const teamA = teams.find(team => team.name === 'A');
    const teamB = teams.find(team => team.name === 'B');
    if (!teamA || !teamB) return [];

    const pairCount = Math.max(teamA.players.length, teamB.players.length);
    const entries: RelayContributionEntry[] = [];

    for (let index = 0; index < pairCount; index += 1) {
        const players: Array<{ teamName: 'A' | 'B'; player?: TournamentPlayer }> = [
            { teamName: 'A', player: teamA.players[index] },
            { teamName: 'B', player: teamB.players[index] },
        ];

        players.forEach(({ teamName, player }) => {
            if (!player) return;
            const opponent = teamName === 'A' ? teamB.players[index] : teamA.players[index];
            entries.push({
                player,
                teamName,
                matchIndex: index,
                breakdown: calculatePlayerGameBreakdown(player, opponent, settings),
                teamRank: 0,
                overallRank: 0,
            });
        });
    }

    const sortedOverall = [...entries].sort((a, b) => b.breakdown.total - a.breakdown.total);
    sortedOverall.forEach((entry, index) => {
        entry.overallRank = index + 1;
    });

    (['A', 'B'] as const).forEach(teamName => {
        const teamEntries = entries
            .filter(entry => entry.teamName === teamName)
            .sort((a, b) => b.breakdown.total - a.breakdown.total);
        teamEntries.forEach((entry, index) => {
            entry.teamRank = index + 1;
        });
    });

    return entries.sort((a, b) => {
        if (a.teamName !== b.teamName) return a.teamName.localeCompare(b.teamName);
        return a.teamRank - b.teamRank;
    });
}

export function findRelayMvp(
    teams: Team[],
    settings: TournamentSettings
): TournamentPlayer | null {
    const entries = buildRelayContributionEntries(teams, settings);
    if (entries.length === 0) return null;
    return entries.reduce((best, entry) =>
        entry.breakdown.total > best.breakdown.total ? entry : best
    ).player;
}
