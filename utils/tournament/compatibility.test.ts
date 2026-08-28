import { describe, expect, it } from 'vitest';
import {
    INITIAL_CHESS_MISSIONS,
    INITIAL_EVENT_SETTINGS,
    INITIAL_GACHA_STATES,
    INITIAL_GENERAL_SETTINGS,
    INITIAL_GROUP_SETTINGS,
    INITIAL_MISSIONS,
    INITIAL_SHOP_CATEGORIES,
    INITIAL_SHOP_ITEMS,
    INITIAL_SPECIAL_MISSIONS,
    INITIAL_STUDENTS,
    INITIAL_TOURNAMENT_DATA,
    INITIAL_TOURNAMENT_SETTINGS,
} from '../../data/initialData';
import type { AppData } from '../../types';
import { normalizeAppDataCompatibility } from './compatibility';

const defaults = (): AppData => ({
    groupSettings: structuredClone(INITIAL_GROUP_SETTINGS),
    generalSettings: structuredClone(INITIAL_GENERAL_SETTINGS),
    eventSettings: structuredClone(INITIAL_EVENT_SETTINGS),
    tournamentSettings: structuredClone(INITIAL_TOURNAMENT_SETTINGS),
    shopSettings: { bulkPurchaseDiscountRate: 0 },
    students: structuredClone(INITIAL_STUDENTS),
    missions: structuredClone(INITIAL_MISSIONS),
    chessMissions: structuredClone(INITIAL_CHESS_MISSIONS),
    specialMissions: structuredClone(INITIAL_SPECIAL_MISSIONS),
    shopItems: structuredClone(INITIAL_SHOP_ITEMS),
    transactions: [],
    coupons: [],
    shopCategories: structuredClone(INITIAL_SHOP_CATEGORIES),
    chessMatches: [],
    gachaState: structuredClone(INITIAL_GACHA_STATES),
    tournamentData: structuredClone(INITIAL_TOURNAMENT_DATA),
    lastBirthdayCouponMonth: null,
    individualMissionSeries: [],
    studentMissionProgress: {},
    tournamentAwardLedger: [],
});

const player = (studentId: string) => ({
    studentId,
    name: studentId,
    rank: '1급',
    game1Handicap: 0,
    game1Color: 'black',
    game1Result: null,
    game2Score: null,
    game2LastStone: false,
    game3Score: null,
});

describe('legacy AppData compatibility', () => {
    it('preserves saved records and backfills the new tournament shape', () => {
        const students = ['relay-a', 'relay-b', 'bracket-a', 'bracket-b', 'swiss-a', 'swiss-b',
            'hybrid-a', 'hybrid-b', 'league-a', 'league-b', 'double-a', 'double-b', 'mission-a']
            .map((id, index) => ({
                id,
                name: `학생 ${index + 1}`,
                rank: '1급',
                group: '고급',
                stones: index,
                maxStones: 100,
                status: '재원',
                birthday: '01-01',
            }));
        const transaction = {
            id: 'tx-legacy',
            studentId: 'relay-a',
            type: 'adjustment',
            description: '레거시 조정',
            amount: 7,
            timestamp: '2025-01-02T03:04:05.000Z',
            status: 'active',
            stoneBalanceBefore: 1,
            stoneBalanceAfter: 8,
        };
        const bracket = {
            players: [player('bracket-a'), player('bracket-b')],
            rounds: [{
                title: '결승',
                matches: [{
                    id: 'bracket-result',
                    players: [player('bracket-a'), player('bracket-b')],
                    winnerId: 'bracket-a',
                }],
            }],
        };
        const legacy = {
            students,
            transactions: [transaction],
            coupons: null,
            tournamentSettings: {
                games: ['game1'],
                championPrize: 777,
                legacySetting: 'keep-me',
                missionBaduk: null,
            },
            tournamentData: {
                participantIds: ['relay-a', 'relay-b'],
                teams: [
                    { name: 'A', players: [player('relay-a')], mannerPenalties: 2 },
                    { name: 'B', players: [player('relay-b')], mannerPenalties: 0 },
                ],
                bracket,
                relay: null,
                swiss: {
                    status: 'finished',
                    players: [{ studentId: 'swiss-a' }, { studentId: 'swiss-b' }],
                    rounds: [{
                        roundIndex: 0,
                        matches: [{ id: 'swiss-top-result', players: ['swiss-a', 'swiss-b'], winnerId: 'swiss-a' }],
                    }],
                    groups: [{
                        id: 'swiss-group',
                        label: '1조',
                        players: [{ studentId: 'swiss-a' }, { studentId: 'swiss-b' }],
                        rounds: [{
                            roundIndex: 0,
                            matches: [{ id: 'swiss-result', players: ['swiss-a', 'swiss-b'], winnerId: 'swiss-a' }],
                        }],
                    }],
                },
                hybrid: {
                    players: [{ studentId: 'hybrid-a' }],
                    preliminaryGroups: [{
                        groupIndex: 0,
                        matches: [{
                            id: 'hybrid-result',
                            players: ['hybrid-a', 'hybrid-b'],
                            winnerId: 'hybrid-b',
                        }],
                    }],
                    bracket: null,
                },
                fullLeague: {
                    players: [{ studentId: 'league-a' }, { studentId: 'league-b' }],
                    matches: [{
                        id: 'league-result',
                        player1Id: 'league-a',
                        player2Id: 'league-b',
                        winnerId: 'league-a',
                    }],
                },
                doubleElim: {
                    playerIds: ['double-a', 'double-b'],
                    winnersRounds: [],
                    losersRounds: [],
                    grandFinal: {
                        id: 'double-result',
                        players: ['double-a', 'double-b'],
                        winnerId: 'double-a',
                    },
                },
                missionBaduk: { players: [{ studentId: 'mission-a' }] },
                legacyTournamentKey: { result: 'keep-me' },
            },
            unknownRootKey: { retained: true },
        };

        const normalized = normalizeAppDataCompatibility(legacy, defaults());
        const tournament = normalized.tournamentData;

        expect(normalized.students).toEqual(students);
        expect(normalized.transactions).toEqual([transaction]);
        expect(normalized.coupons).toEqual([]);
        expect(tournament.bracket).toEqual(bracket);
        expect(tournament.relayParticipantIds).toEqual(['relay-a', 'relay-b']);
        expect(tournament.bracketParticipantIds).toEqual(['bracket-a', 'bracket-b']);
        expect(tournament.swissParticipantIds).toEqual(['swiss-a', 'swiss-b']);
        expect(tournament.hybridParticipantIds).toEqual(['hybrid-a', 'hybrid-b']);
        expect(tournament.swiss?.rounds).toEqual([[
            { id: 'swiss-top-result', players: ['swiss-a', 'swiss-b'], winnerId: 'swiss-a' },
        ]]);
        expect(tournament.swiss?.groups?.[0].rounds).toEqual([[
            { id: 'swiss-result', players: ['swiss-a', 'swiss-b'], winnerId: 'swiss-a' },
        ]]);
        expect(tournament.hybrid?.preliminaryGroups).toEqual([[
            { id: 'hybrid-result', players: ['hybrid-a', 'hybrid-b'], winnerId: 'hybrid-b' },
        ]]);
        expect(tournament.fullLeagueParticipantIds).toEqual(['league-a', 'league-b']);
        expect(tournament.doubleElimParticipantIds).toEqual(['double-a', 'double-b']);
        expect(tournament.missionParticipantIds).toEqual(['mission-a']);
        expect(tournament.awardSessionIds).toEqual({});
        expect(normalized.tournamentAwardLedger).toEqual([]);
        expect(normalized.tournamentSettings).toMatchObject({
            games: ['game1'],
            championPrize: 777,
            swissPaidRankCount: 3,
            swissUseGroups: false,
            byePriority: 'min_byes',
            legacySetting: 'keep-me',
            missionBaduk: INITIAL_TOURNAMENT_SETTINGS.missionBaduk,
        });
        expect(normalized).toHaveProperty('unknownRootKey.retained', true);
        expect(tournament).toHaveProperty('legacyTournamentKey.result', 'keep-me');

        expect(legacy).not.toHaveProperty('tournamentData.relayParticipantIds');
        expect(legacy.coupons).toBeNull();
    });

    it('retains explicit participant selections and tolerates null tournament data', () => {
        const selected = normalizeAppDataCompatibility({
            students: [],
            tournamentData: {
                bracketParticipantIds: [],
                bracket: {
                    players: [player('old-bracket-player')],
                    rounds: [],
                },
                teams: null,
                awardSessionIds: null,
            },
        }, defaults());

        expect(selected.tournamentData.bracketParticipantIds).toEqual([]);
        expect(selected.tournamentData.teams).toEqual(INITIAL_TOURNAMENT_DATA.teams);
        expect(selected.tournamentData.awardSessionIds).toEqual({});

        const missing = normalizeAppDataCompatibility({
            students: [],
            tournamentData: null,
        }, defaults());
        expect(missing.tournamentData).toEqual(INITIAL_TOURNAMENT_DATA);
    });
});
