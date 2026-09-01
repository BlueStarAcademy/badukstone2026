import { describe, expect, it } from 'vitest';
import type { Team, TournamentPlayer, TournamentSettings } from '../../types';
import {
    buildRelayContributionEntries,
    calculatePlayerGameBreakdown,
    calculateRelayTeamScores,
    computeAutoGame1Handicap,
    getEffectiveGame1Handicap,
} from './relayScoring';

const baseSettings: TournamentSettings = {
    games: ['game1', 'game2', 'game3'],
    game1SameRankHandicap: 6.5,
    game1RankDiffHandicap: 5,
    game2StoneValue: 2,
    game2LastStoneBonus: 3,
    game3StoneValue: 1,
    relayMannerPenalty: 5,
    championPrize: 100,
    runnerUpPrize: 50,
    semiFinalistPrize: 30,
    participantPrize: 10,
    swissRounds: 3,
    swiss1stPrize: 100,
    swiss2ndPrize: 50,
    swiss3rdPrize: 30,
    swissUseGroups: false,
    swissGroupSizes: '',
};

const player = (overrides: Partial<TournamentPlayer>): TournamentPlayer => ({
    studentId: 'p1',
    name: 'Alpha',
    rank: '10급',
    game1Handicap: 0,
    game1Color: 'black',
    game1Result: null,
    game2Score: null,
    game2LastStone: false,
    game3Score: null,
    ...overrides,
});

describe('relayScoring', () => {
    it('auto-calculates same-rank white komi', () => {
        const white = player({ game1Color: 'white', rank: '10급' });
        const black = player({ studentId: 'p2', name: 'Beta', game1Color: 'black', rank: '10급' });
        expect(computeAutoGame1Handicap(white, black, baseSettings)).toBe(6.5);
        expect(computeAutoGame1Handicap(black, white, baseSettings)).toBe(0);
    });

    it('uses manual override when set', () => {
        const black = player({ game1Color: 'black', game1Handicap: 8, game1HandicapOverride: true });
        const white = player({ studentId: 'p2', name: 'Beta', game1Color: 'white', rank: '5급' });
        expect(getEffectiveGame1Handicap(black, white, baseSettings)).toBe(8);
    });

    it('combines result and komi into game1 contribution', () => {
        const black = player({
            game1Color: 'black',
            game1Handicap: 10,
            game1HandicapOverride: true,
            game1Result: 3,
        });
        const white = player({
            studentId: 'p2',
            name: 'Beta',
            game1Color: 'white',
            rank: '10급',
            game1Result: 2,
        });
        expect(calculatePlayerGameBreakdown(black, white, baseSettings).game1).toBe(13);
        expect(calculatePlayerGameBreakdown(white, black, baseSettings).game1).toBe(8.5);
    });

    it('aggregates team totals with komi and adjustments', () => {
        const teamA: Team = {
            name: 'A',
            players: [
                player({ game1Result: 2, game1HandicapOverride: true, game1Handicap: 5, game2Score: 1, game3Score: 2 }),
            ],
            mannerPenalties: 1,
            bonusScore: 4,
        };
        const teamB: Team = {
            name: 'B',
            players: [
                player({
                    studentId: 'p2',
                    name: 'Beta',
                    game1Color: 'white',
                    game1Result: 1,
                    game2Score: 0,
                    game3Score: 1,
                }),
            ],
        };

        const scoresA = calculateRelayTeamScores(teamA, teamB, baseSettings);
        expect(scoresA.game1Score).toBe(7);
        expect(scoresA.game2Score).toBe(2);
        expect(scoresA.game3Score).toBe(2);
        expect(scoresA.totalScore).toBe(10);
    });

    it('builds team and overall ranks', () => {
        const teamA: Team = {
            name: 'A',
            players: [
                player({ studentId: 'a1', name: 'A1', game1Result: 5, game2Score: 1 }),
                player({ studentId: 'a2', name: 'A2', game1Result: 1 }),
            ],
        };
        const teamB: Team = {
            name: 'B',
            players: [
                player({ studentId: 'b1', name: 'B1', game1Color: 'white', game1Result: 8 }),
                player({ studentId: 'b2', name: 'B2', game1Color: 'white', game1Result: 0 }),
            ],
        };

        const entries = buildRelayContributionEntries([teamA, teamB], baseSettings);
        const b1 = entries.find(entry => entry.player.studentId === 'b1');
        const a2 = entries.find(entry => entry.player.studentId === 'a2');
        expect(b1?.overallRank).toBe(1);
        expect(a2?.teamRank).toBe(2);
    });
});
