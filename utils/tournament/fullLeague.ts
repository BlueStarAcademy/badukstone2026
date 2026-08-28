import type { FullLeagueData, FullLeagueMatch } from '../../types';
import type { TournamentParticipant } from './domain';

export type IdFactory = () => string;

export function recomputeFullLeagueStandings(data: FullLeagueData): FullLeagueData {
    const players = data.players.map(player => {
        const played = data.matches.filter(
            match => match.player1Id === player.studentId || match.player2Id === player.studentId
        );
        return {
            ...player,
            wins: played.filter(match => match.winnerId === player.studentId).length,
            losses: played.filter(match => match.winnerId && match.winnerId !== player.studentId).length,
        };
    });
    return { ...data, players };
}

export function createFullLeague(
    participants: TournamentParticipant[],
    createId: IdFactory
): FullLeagueData {
    const matches: FullLeagueMatch[] = [];
    for (let i = 0; i < participants.length; i += 1) {
        for (let j = i + 1; j < participants.length; j += 1) {
            matches.push({
                id: createId(),
                player1Id: participants[i].id,
                player2Id: participants[j].id,
                winnerId: null,
            });
        }
    }
    return {
        players: participants.map(player => ({
            studentId: player.id,
            name: player.name,
            wins: 0,
            losses: 0,
        })),
        matches,
    };
}

export function setFullLeagueWinner(
    data: FullLeagueData,
    matchId: string,
    clickedPlayerId: string
): FullLeagueData {
    const matches = data.matches.map(match =>
        match.id === matchId
            ? { ...match, winnerId: match.winnerId === clickedPlayerId ? null : clickedPlayerId }
            : match
    );
    return recomputeFullLeagueStandings({ ...data, matches });
}

export function sortFullLeaguePlayers(data: FullLeagueData): FullLeagueData['players'] {
    return [...recomputeFullLeagueStandings(data).players].sort(
        (a, b) => b.wins - a.wins || a.losses - b.losses
    );
}
