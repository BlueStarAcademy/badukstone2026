import { describe, expect, it } from 'vitest';
import type { DoubleElimData, SwissMatch, SwissPlayer } from '../../types';
import { buildElimRoundOneSlotOrder } from '../byePlacement';
import { buildDoubleElim, propagateAllWinners } from '../doubleElimBracket';
import { getDoubleElimPlacements } from '../tournamentPrizes';
import {
    cancelLastSwissRound,
    createFullLeague,
    createSwissPairings,
    recomputeSwissStats,
    selectHybridQualifiersPerGroup,
    setFullLeagueWinner,
} from '.';

const ids = () => {
    let value = 0;
    return () => `id-${++value}`;
};

const swissPlayers = (...playerIds: string[]): SwissPlayer[] =>
    playerIds.map(studentId => ({
        studentId,
        name: studentId,
        score: 99,
        opponents: ['stale'],
        sos: 99,
        sosos: 99,
    }));

describe('elimination bye placement', () => {
    it('creates exactly the minimum number of byes without losing a seed', () => {
        const seeds = ['a', 'b', 'c', 'd', 'e', 'f'];
        const { bracketSize, slots } = buildElimRoundOneSlotOrder(seeds, 'min_byes', false);
        expect(bracketSize).toBe(8);
        expect(slots.filter(slot => slot === 'BYE')).toHaveLength(2);
        expect(slots.filter(slot => slot !== 'BYE').sort()).toEqual([...seeds].sort());
    });
});

describe('full league', () => {
    it('creates C(n, 2) unique matches', () => {
        const participants = ['a', 'b', 'c', 'd', 'e'].map(id => ({ id, name: id, rank: '1급' }));
        const league = createFullLeague(participants, ids());
        expect(league.matches).toHaveLength(10);
        expect(new Set(league.matches.map(match => [match.player1Id, match.player2Id].sort().join(':'))).size).toBe(10);

        const selected = setFullLeagueWinner(league, league.matches[0].id, 'a');
        expect(selected.players.find(player => player.studentId === 'a')).toMatchObject({ wins: 1, losses: 0 });
        const cancelled = setFullLeagueWinner(selected, league.matches[0].id, 'a');
        expect(cancelled.players.find(player => player.studentId === 'a')).toMatchObject({ wins: 0, losses: 0 });
    });
});

describe('Swiss engine', () => {
    const rounds: SwissMatch[][] = [
        [
            { id: '1', players: ['a', 'b'], winnerId: 'a' },
            { id: '2', players: ['c', 'd'], winnerId: 'c' },
        ],
        [
            { id: '3', players: ['a', 'c'], winnerId: 'a' },
            { id: '4', players: ['b', 'd'], winnerId: 'b' },
        ],
    ];

    it('recomputes score, SOS and SOSOS solely from rounds', () => {
        const players = recomputeSwissStats(swissPlayers('a', 'b', 'c', 'd'), rounds);
        expect(players.map(player => player.score)).toEqual([2, 1, 1, 0]);
        expect(players.map(player => player.sos)).toEqual([2, 2, 2, 2]);
        expect(players.map(player => player.sosos)).toEqual([4, 4, 4, 4]);
    });

    it('does not assign a second bye until everyone has had one', () => {
        const firstRound: SwissMatch[][] = [[
            { id: '1', players: ['a', 'BYE'], winnerId: 'a' },
            { id: '2', players: ['b', 'c'], winnerId: 'b' },
        ]];
        const next = createSwissPairings(
            swissPlayers('a', 'b', 'c'),
            firstRound,
            'min_matches',
            ids(),
            () => 0.5
        );
        const bye = next.find(match => match.players.includes('BYE'));
        expect(bye?.players[0]).not.toBe('a');
    });

    it('cancelling a round removes its result, opponents and bye', () => {
        const withBye: SwissMatch[][] = [
            [{ id: '1', players: ['a', 'b'], winnerId: 'a' }],
            [
                { id: '2', players: ['a', 'BYE'], winnerId: 'a' },
                { id: '3', players: ['b', 'c'], winnerId: 'b' },
            ],
        ];
        const cancelled = cancelLastSwissRound(swissPlayers('a', 'b', 'c'), withBye);
        expect(cancelled.rounds).toHaveLength(1);
        expect(cancelled.players.find(player => player.studentId === 'a')).toMatchObject({
            score: 1,
            opponents: ['b'],
        });
        expect(cancelled.players.every(player => !player.opponents.includes('BYE'))).toBe(true);
    });
});

describe('hybrid advancement', () => {
    it('takes the configured number from each group, not globally', () => {
        const groups: SwissMatch[][] = [
            [
                { id: '1', players: ['a', 'b'], winnerId: 'a' },
                { id: '2', players: ['a', 'c'], winnerId: 'a' },
                { id: '3', players: ['b', 'c'], winnerId: 'b' },
            ],
            [
                { id: '4', players: ['d', 'e'], winnerId: 'd' },
                { id: '5', players: ['d', 'f'], winnerId: 'd' },
                { id: '6', players: ['e', 'f'], winnerId: 'e' },
            ],
        ];
        expect(selectHybridQualifiersPerGroup(swissPlayers('a', 'b', 'c', 'd', 'e', 'f'), groups, 1)
            .map(player => player.studentId)).toEqual(['a', 'd']);
    });
});

describe('double elimination', () => {
    it('propagates winners and reports final placements', () => {
        const data = buildDoubleElim(['a', 'b', 'c', 'd'], 'min_byes');
        const [m1, m2] = data.winnersRounds[0].matches;
        m1.winnerId = m1.players[0] as string;
        m2.winnerId = m2.players[0] as string;
        propagateAllWinners(data);
        expect(data.winnersRounds[1].matches[0].players.filter(Boolean)).toHaveLength(2);
        expect(data.losersRounds[0].matches[0].players.filter(Boolean)).toHaveLength(2);
        const oldWinner = m1.winnerId;
        m1.winnerId = m1.players.find(player => player !== oldWinner) as string;
        data.winnersRounds[1].matches[0].winnerId = oldWinner;
        propagateAllWinners(data);
        expect(data.winnersRounds[1].matches[0].players).toContain(m1.winnerId);
        expect(data.winnersRounds[1].matches[0].winnerId).toBeNull();

        const placements = {
            winnersRounds: [{ title: '승자 결승', matches: [{ id: 'w', players: ['a', 'b'], winnerId: 'a' }] }],
            losersRounds: [{ title: '패자 결승', matches: [{ id: 'l', players: ['b', 'c'], winnerId: 'b' }] }],
            grandFinal: { id: 'g', players: ['a', 'b'], winnerId: 'a' },
            playerIds: ['a', 'b', 'c', 'd'],
        } satisfies DoubleElimData;
        expect(getDoubleElimPlacements(placements)).toEqual({
            championId: 'a',
            runnerUpId: 'b',
            semiFinalistIds: ['c'],
        });
    });

    it('preserves the delayed seeded match in the six-player format', () => {
        const data = buildDoubleElim(['a', 'b', 'c', 'd', 'e', 'f'], 'min_matches');
        const delayedSeeds = [...data.winnersRounds[1].matches[1].players];
        propagateAllWinners(data);
        expect(data.winnersRounds[1].matches[1].players).toEqual(delayedSeeds);
    });
});
