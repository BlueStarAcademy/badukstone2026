import type { SwissMatch, SwissPlayer } from '../../types';
import type { IdFactory } from './fullLeague';
import type { TournamentParticipant } from './domain';
import { recomputeSwissStats } from './swiss';
import { asArray, normalizeHybridPreliminaryGroups } from './compatibility';

export const DEFAULT_HYBRID_ADVANCE_PER_GROUP = 2;

export function getHybridAdvanceCountPerGroup(value: number | undefined): number {
    if (!Number.isFinite(value) || value == null) return DEFAULT_HYBRID_ADVANCE_PER_GROUP;
    return Math.max(1, Math.floor(value));
}

export function distributeHybridGroups<T>(players: T[], groupCount: number): T[][] {
    const count = Math.max(1, Math.floor(groupCount));
    const groups: T[][] = Array.from({ length: count }, () => []);
    players.forEach((player, index) => {
        const pass = Math.floor(index / count);
        const offset = index % count;
        const groupIndex = pass % 2 === 0 ? offset : count - 1 - offset;
        groups[groupIndex].push(player);
    });
    return groups;
}

export function createRoundRobinMatches(
    participants: TournamentParticipant[],
    createId: IdFactory
): SwissMatch[] {
    const matches: SwissMatch[] = [];
    for (let i = 0; i < participants.length; i += 1) {
        for (let j = i + 1; j < participants.length; j += 1) {
            matches.push({
                id: createId(),
                players: [participants[i].id, participants[j].id],
                winnerId: null,
            });
        }
    }
    return matches;
}

/** Select N qualifiers independently from every preliminary group. */
export function selectHybridQualifiersPerGroup(
    players: SwissPlayer[],
    preliminaryGroups: SwissMatch[][],
    advancePerGroup: number
): SwissPlayer[] {
    const count = getHybridAdvanceCountPerGroup(advancePerGroup);
    const groups = normalizeHybridPreliminaryGroups(preliminaryGroups) as SwissMatch[][];
    const safePlayers = asArray<SwissPlayer>(players);
    return groups.flatMap(group => {
        const matches = asArray<SwissMatch>(group);
        const ids = new Set(
            matches.flatMap(match => asArray<string | 'BYE'>(match?.players)).filter(id => id !== 'BYE')
        );
        const groupPlayers = safePlayers.filter(player => ids.has(player.studentId));
        const withStats = recomputeSwissStats(groupPlayers, [matches]);
        return withStats
            .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
            .slice(0, count);
    });
}
