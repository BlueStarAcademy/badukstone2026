import { describe, expect, it } from 'vitest';
import type { DoubleElimData, SwissMatch, SwissPlayer } from '../../types';
import { buildElimRoundOneSlotOrder, listValidStartRoundSizes, planElimBracket } from '../byePlacement';
import { buildSingleElimRounds, playInFeederTarget, propagateSingleElimWinners } from '../elimBracket';
import { buildDoubleElim, isDoubleElimComplete, propagateAllWinners } from '../doubleElimBracket';
import { getDoubleElimPlacements } from '../tournamentPrizes';
import { sortSwissPlayers } from '../index';
import {
    cancelLastSwissRound,
    createFullLeague,
    createSwissFirstRound,
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
    it('uses a play-in into the previous power of two for six players', () => {
        const seeds = ['a', 'b', 'c', 'd', 'e', 'f'];
        const { bracketSize, slots, playInMatchCount, byeRecipients } = buildElimRoundOneSlotOrder(
            seeds,
            'min_byes',
            false
        );
        expect(bracketSize).toBe(4);
        expect(playInMatchCount).toBe(2);
        expect(byeRecipients).toHaveLength(2);
        expect(slots).toHaveLength(4);
        expect(slots).not.toContain('BYE');
        expect([...slots, ...byeRecipients].sort()).toEqual([...seeds].sort());
    });

    it('creates a complete eight-match first round for 16 players', () => {
        const seeds = Array.from({ length: 16 }, (_, index) => `seed-${index + 1}`);
        const { bracketSize, slots, playInMatchCount } = buildElimRoundOneSlotOrder(seeds, 'min_byes', false);
        const matches = Array.from({ length: slots.length / 2 }, (_, index) =>
            slots.slice(index * 2, index * 2 + 2)
        );

        expect(bracketSize).toBe(16);
        expect(playInMatchCount).toBe(0);
        expect(matches).toHaveLength(8);
        expect(slots).not.toContain('BYE');
        expect(new Set(slots)).toEqual(new Set(seeds));
    });

    it('builds a 20-player field as 4 play-in matches into a 16-bracket', () => {
        const seeds = Array.from({ length: 20 }, (_, index) => `seed-${index + 1}`);
        const { bracketSize, slots, playInMatchCount, byeRecipients } = buildElimRoundOneSlotOrder(
            seeds,
            'min_byes',
            false
        );
        expect(bracketSize).toBe(16);
        expect(playInMatchCount).toBe(4);
        expect(byeRecipients).toHaveLength(12);
        expect(slots).toHaveLength(8);
        expect(slots).not.toContain('BYE');
        expect(new Set([...slots, ...byeRecipients])).toEqual(new Set(seeds));
    });
});

describe('forced start round size', () => {
    it('pads byes when forcing a larger main draw than the field', () => {
        expect(planElimBracket(5, 8)).toEqual({
            mainDrawSize: 8,
            playInMatchCount: 0,
            byeCount: 3,
        });
        expect(listValidStartRoundSizes(5)).toEqual([4, 8]);
        expect(listValidStartRoundSizes(20)).toEqual([16, 32]);
    });

    it('keeps play-in when forcing a compact smaller draw', () => {
        expect(planElimBracket(10, 8)).toEqual({
            mainDrawSize: 8,
            playInMatchCount: 2,
            byeCount: 6,
        });
    });

    it('builds forced slot order with bye pads for larger draws', () => {
        const seeds = ['a', 'b', 'c', 'd', 'e'];
        const { bracketSize, slots, playInMatchCount, byeRecipients } = buildElimRoundOneSlotOrder(
            seeds,
            'min_byes',
            false,
            8
        );
        expect(bracketSize).toBe(8);
        expect(playInMatchCount).toBe(0);
        expect(byeRecipients).toHaveLength(0);
        expect(slots.filter(slot => slot === 'BYE')).toHaveLength(3);
    });

    it('builds forced 8강 rounds for five players with bye auto-wins', () => {
        const players = Array.from({ length: 5 }, (_, index) => ({
            studentId: `p${index + 1}`,
            name: `p${index + 1}`,
            rank: `${index + 1}급`,
            game1Handicap: 0,
            game1Color: 'black' as const,
            game1Result: null,
            game2Score: null,
            game2LastStone: false,
            game3Score: null,
        }));
        const { rounds, mainDrawSize, playInMatchCount } = buildSingleElimRounds(players, 'min_byes', false, 8);
        expect(mainDrawSize).toBe(8);
        expect(playInMatchCount).toBe(0);
        expect(rounds[0].title).toBe('8강');
        expect(rounds[0].matches).toHaveLength(4);
        const byeWins = rounds[0].matches.filter(match => match.winnerId).length;
        expect(byeWins).toBe(3);
    });

    it('builds forced double-elim 8강 for five players with bye auto-wins', () => {
        const data = buildDoubleElim(['a', 'b', 'c', 'd', 'e'], 'min_byes', 8);
        expect(data.winnersRounds[0].title).toBe('8강');
        expect(data.winnersRounds[0].matches).toHaveLength(4);
        const byeWins = data.winnersRounds[0].matches.filter(match => match.winnerId).length;
        expect(byeWins).toBe(3);
    });

    it('maps seven-player play-in winners into a four-player main draw without orphan slots', () => {
        const players = Array.from({ length: 7 }, (_, index) => ({
            studentId: `p${index + 1}`,
            name: `p${index + 1}`,
            rank: `${index + 1}급`,
            game1Handicap: 0,
            game1Color: 'black' as const,
            game1Result: null,
            game2Score: null,
            game2LastStone: false,
            game3Score: null,
        }));
        const { rounds, mainDrawSize, playInMatchCount } = buildSingleElimRounds(
            players,
            'min_byes',
            false
        );
        expect(mainDrawSize).toBe(4);
        expect(playInMatchCount).toBe(3);
        expect(rounds[0].matches).toHaveLength(3);
        expect(rounds[1].matches).toHaveLength(2);

        // byeCount = 1 → first play-in → match0 slot1; remaining two → match1 both slots
        expect(playInFeederTarget(0, 3, 4)).toEqual({ matchIndex: 0, slot: 1 });
        expect(playInFeederTarget(1, 3, 4)).toEqual({ matchIndex: 1, slot: 0 });
        expect(playInFeederTarget(2, 3, 4)).toEqual({ matchIndex: 1, slot: 1 });

        rounds[0].matches.forEach(match => {
            match.winnerId = (match.players[0] as { studentId: string }).studentId;
        });
        propagateSingleElimWinners({ rounds, players });
        const main = rounds[1];
        const filled = main.matches.flatMap(match => match.players).filter(Boolean);
        expect(filled).toHaveLength(4);
        expect(main.matches.every(match => match.players[0] && match.players[1])).toBe(true);
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

    it('sorts Firestore wrapped rounds without throwing', () => {
        const players = recomputeSwissStats(swissPlayers('a', 'b'), [[
            { id: '1', players: ['a', 'b'], winnerId: 'a' },
        ]]);
        const firestoreRounds = [{
            roundIndex: 0,
            matches: [{ id: '1', players: ['a', 'b'], winnerId: 'a' }],
        }] as unknown as SwissMatch[][];
        expect(sortSwissPlayers(players, firestoreRounds).map(player => player.studentId)).toEqual(['a', 'b']);
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

    it('creates one automatic bye and complete pairings for an odd field', () => {
        const players = swissPlayers('a', 'b', 'c', 'd', 'e');
        const round = createSwissFirstRound(players, 'min_byes', ids());
        const byeMatches = round.filter(match => match.players.includes('BYE'));
        const scheduledIds = round.flatMap(match => match.players).filter(id => id !== 'BYE');

        expect(round).toHaveLength(3);
        expect(byeMatches).toHaveLength(1);
        expect(byeMatches[0].winnerId).toBe(byeMatches[0].players[0]);
        expect(new Set(scheduledIds)).toEqual(new Set(players.map(player => player.studentId)));
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
        expect(data.losersRounds).toHaveLength(2);
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
            placementIds: ['a', 'b', 'c', 'd'],
        });
    });

    it('requires a reset grand final when the losers bracket wins GF1', () => {
        const data = buildDoubleElim(['a', 'b', 'c', 'd'], 'min_byes');
        data.grandFinal = { id: 'g1', players: ['a', 'b'], winnerId: 'b' };
        data.grandFinalReset = { id: 'g2', players: ['a', 'b'], winnerId: null };
        expect(isDoubleElimComplete(data)).toBe(false);
        data.grandFinalReset.winnerId = 'a';
        expect(isDoubleElimComplete(data)).toBe(true);
        expect(getDoubleElimPlacements(data)).toMatchObject({
            championId: 'a',
            runnerUpId: 'b',
        });
    });

    it('ends after GF1 when the winners bracket champion holds', () => {
        const data = buildDoubleElim(['a', 'b', 'c', 'd'], 'min_byes');
        data.grandFinal = { id: 'g1', players: ['a', 'b'], winnerId: 'a' };
        data.grandFinalReset = { id: 'g2', players: [null, null], winnerId: null };
        expect(isDoubleElimComplete(data)).toBe(true);
        expect(getDoubleElimPlacements(data)).toMatchObject({
            championId: 'a',
            runnerUpId: 'b',
        });
    });

    it('pads five players to an eight-bracket and builds a full losers bracket', () => {
        const data = buildDoubleElim(['a', 'b', 'c', 'd', 'e'], 'min_byes');
        expect(data.winnersRounds[0].matches).toHaveLength(4);
        expect(data.losersRounds.length).toBeGreaterThanOrEqual(4);
        expect(data.grandFinalReset).toBeTruthy();
    });

    it('preserves the delayed seeded match in the six-player format', () => {
        const data = buildDoubleElim(['a', 'b', 'c', 'd', 'e', 'f'], 'min_matches');
        const delayedSeeds = [...data.winnersRounds[1].matches[1].players];
        propagateAllWinners(data);
        expect(data.winnersRounds[1].matches[1].players).toEqual(delayedSeeds);
        expect(data.grandFinalReset).toBeTruthy();
    });
});
