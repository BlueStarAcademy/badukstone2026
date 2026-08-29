import { describe, expect, it } from 'vitest';
import {
    getBracketRankAmounts,
    bracketRowFromRankAmounts,
    defaultBracketGroupPrize,
    buildBracketStyleGrants,
    getBracketPaidRankCount,
    getBracketOrderedPlacementIds,
    getDoubleElimPlacements,
} from './tournamentPrizes';
import type { DoubleElimData, TournamentBracket, TournamentSettings } from '../types';
import { INITIAL_TOURNAMENT_SETTINGS } from '../data/initialData';
import { isFinalRoundTitle, isSemiFinalRoundTitle } from './elimBracket';
import { cloneDeep } from './tournament/clone';

describe('bracket prize ranks', () => {
    it('splits 3rd/4th and keeps extra ranks for 5–8', () => {
        const row = bracketRowFromRankAmounts([100, 50, 30, 20, 15, 12, 10, 8], 5);
        expect(row.third).toBe(30);
        expect(row.fourth).toBe(20);
        expect(row.semiFinalist).toBe(30);
        expect(row.extraRanks).toEqual([15, 12, 10, 8]);
        expect(getBracketRankAmounts(row, 8)).toEqual([100, 50, 30, 20, 15, 12, 10, 8]);
    });

    it('falls back to semiFinalist when third/fourth missing', () => {
        const amounts = getBracketRankAmounts(
            { champion: 100, runnerUp: 50, semiFinalist: 25, participant: 5 },
            4
        );
        expect(amounts).toEqual([100, 50, 25, 25]);
    });

    it('uses settings defaults including extras', () => {
        const settings = {
            ...INITIAL_TOURNAMENT_SETTINGS,
            bracketPaidRankCount: 8,
            thirdPlacePrize: 30,
            fourthPlacePrize: 20,
            bracketExtraRankPrizes: [15, 12, 10, 8],
        } satisfies TournamentSettings;
        expect(getBracketPaidRankCount(settings)).toBe(8);
        expect(getBracketRankAmounts(defaultBracketGroupPrize(settings), 8)).toEqual([
            100, 50, 30, 20, 15, 12, 10, 8,
        ]);
    });

    it('builds separate grants for 3rd, 4th, and lower ranks', () => {
        const grants = buildBracketStyleGrants(
            ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'],
            {
                champion: 100,
                runnerUp: 50,
                third: 30,
                fourth: 20,
                participant: 5,
                extraRanks: [15, 12, 10, 8],
            },
            8,
            '토너먼트'
        );
        expect(grants.find(g => g.studentId === 'c')?.description).toBe('토너먼트 3위');
        expect(grants.find(g => g.studentId === 'd')?.description).toBe('토너먼트 4위');
        expect(grants.find(g => g.studentId === 'e')?.amount).toBe(15);
        expect(grants.find(g => g.studentId === 'i')?.description).toBe('토너먼트 참가상');
    });
});

describe('round title helpers', () => {
    it('recognizes legacy semi-final aliases', () => {
        expect(isSemiFinalRoundTitle('4강전')).toBe(true);
        expect(isSemiFinalRoundTitle('준결승')).toBe(true);
        expect(isSemiFinalRoundTitle('4강')).toBe(true);
        expect(isSemiFinalRoundTitle('8강')).toBe(false);
        expect(isFinalRoundTitle('결승 & 3/4위전')).toBe(true);
        expect(isFinalRoundTitle('8강')).toBe(false);
    });
});

describe('cloneDeep', () => {
    it('deep-copies nested objects without sharing references', () => {
        const src = { a: { b: 1 }, list: [1, 2] };
        const copy = cloneDeep(src);
        expect(copy).toEqual(src);
        expect(copy).not.toBe(src);
        expect(copy.a).not.toBe(src.a);
        copy.a.b = 9;
        expect(src.a.b).toBe(1);
    });
});

describe('getBracketOrderedPlacementIds legacy titles', () => {
    it('finds 준결승 alias for semi-final losers', () => {
        const bracket = {
            players: [
                { studentId: 'a', name: 'a' },
                { studentId: 'b', name: 'b' },
                { studentId: 'c', name: 'c' },
                { studentId: 'd', name: 'd' },
            ],
            rounds: [
                {
                    title: '준결승',
                    matches: [
                        {
                            id: 's1',
                            players: [
                                { studentId: 'a', name: 'a' },
                                { studentId: 'c', name: 'c' },
                            ],
                            winnerId: 'a',
                        },
                        {
                            id: 's2',
                            players: [
                                { studentId: 'b', name: 'b' },
                                { studentId: 'd', name: 'd' },
                            ],
                            winnerId: 'b',
                        },
                    ],
                },
                {
                    title: '결승 & 3/4위전',
                    matches: [
                        {
                            id: 'f',
                            players: [
                                { studentId: 'a', name: 'a' },
                                { studentId: 'b', name: 'b' },
                            ],
                            winnerId: 'a',
                        },
                        {
                            id: 't',
                            players: [
                                { studentId: 'c', name: 'c' },
                                { studentId: 'd', name: 'd' },
                            ],
                            winnerId: 'c',
                        },
                    ],
                },
            ],
        } as unknown as TournamentBracket;
        expect(getBracketOrderedPlacementIds(bracket)).toEqual(['a', 'b', 'c', 'd']);
    });
});
