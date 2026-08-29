import { describe, expect, it } from 'vitest';
import {
    getBracketRankAmounts,
    bracketRowFromRankAmounts,
    defaultBracketGroupPrize,
    buildBracketStyleGrants,
    getBracketPaidRankCount,
} from './tournamentPrizes';
import type { TournamentSettings } from '../types';
import { INITIAL_TOURNAMENT_SETTINGS } from '../data/initialData';

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
