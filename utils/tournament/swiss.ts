import type { SwissMatch, SwissPlayer, TournamentByePriority } from '../../types';
import { pickSwissByeSortedIndex, pickSwissOddByePoolIndex } from '../byePlacement';
import type { IdFactory } from './fullLeague';

export type RandomSource = () => number;

export function recomputeSwissStats(players: SwissPlayer[], rounds: SwissMatch[][]): SwissPlayer[] {
    const next = players.map(player => ({
        ...player,
        score: 0,
        opponents: [] as string[],
        sos: 0,
        sosos: 0,
    }));
    const byId = new Map(next.map(player => [player.studentId, player]));

    for (const match of rounds.flat()) {
        const [id1, id2] = match.players;
        if (id1 !== 'BYE') byId.get(id1)?.opponents.push(id2);
        if (id2 !== 'BYE') byId.get(id2)?.opponents.push(id1);
        if (match.winnerId && match.winnerId !== 'BYE') {
            const winner = byId.get(match.winnerId);
            if (winner) winner.score += 1;
        }
    }
    for (const player of next) {
        player.sos = player.opponents.reduce(
            (sum, id) => sum + (id === 'BYE' ? 0 : byId.get(id)?.score ?? 0),
            0
        );
    }
    for (const player of next) {
        player.sosos = player.opponents.reduce(
            (sum, id) => sum + (id === 'BYE' ? 0 : byId.get(id)?.sos ?? 0),
            0
        );
    }
    return next;
}

function shuffled<T>(items: T[], random: RandomSource): T[] {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

export function createSwissFirstRound(
    orderedPlayers: SwissPlayer[],
    priority: TournamentByePriority,
    createId: IdFactory
): SwissMatch[] {
    const pool = [...orderedPlayers];
    const matches: SwissMatch[] = [];
    if (pool.length % 2 !== 0) {
        const index = pickSwissOddByePoolIndex(pool.length, priority);
        const [byePlayer] = pool.splice(index, 1);
        matches.push({
            id: createId(),
            players: [byePlayer.studentId, 'BYE'],
            winnerId: byePlayer.studentId,
        });
    }
    for (let i = 0; i < pool.length; i += 2) {
        matches.push({
            id: createId(),
            players: [pool[i].studentId, pool[i + 1].studentId],
            winnerId: null,
        });
    }
    return matches;
}

export function createSwissPairings(
    players: SwissPlayer[],
    rounds: SwissMatch[][],
    priority: TournamentByePriority,
    createId: IdFactory,
    random: RandomSource = Math.random
): SwissMatch[] {
    const current = recomputeSwissStats(players, rounds);
    const scoreGroups = new Map<number, SwissPlayer[]>();
    current.forEach(player => {
        const group = scoreGroups.get(player.score) ?? [];
        group.push(player);
        scoreGroups.set(player.score, group);
    });
    const sorted = [...scoreGroups.entries()]
        .sort(([a], [b]) => b - a)
        .flatMap(([, group]) => shuffled(group, random));

    const matches: SwissMatch[] = [];
    if (sorted.length % 2 !== 0) {
        const byeIndex = pickSwissByeSortedIndex(sorted, priority);
        const [byePlayer] = sorted.splice(byeIndex, 1);
        matches.push({
            id: createId(),
            players: [byePlayer.studentId, 'BYE'],
            winnerId: byePlayer.studentId,
        });
    }

    while (sorted.length > 1) {
        const player = sorted.shift()!;
        let opponentIndex = sorted.findIndex(candidate => !player.opponents.includes(candidate.studentId));
        if (opponentIndex < 0) opponentIndex = 0;
        const [opponent] = sorted.splice(opponentIndex, 1);
        matches.push({
            id: createId(),
            players: [player.studentId, opponent.studentId],
            winnerId: null,
        });
    }
    return matches;
}

export function cancelLastSwissRound(
    players: SwissPlayer[],
    rounds: SwissMatch[][]
): { players: SwissPlayer[]; rounds: SwissMatch[][] } {
    const nextRounds = rounds.slice(0, -1);
    return { players: recomputeSwissStats(players, nextRounds), rounds: nextRounds };
}
