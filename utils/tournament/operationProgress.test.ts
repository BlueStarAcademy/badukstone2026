import { describe, expect, it } from 'vitest';
import type { TournamentData, TournamentSettings } from '../../types';
import { getTournamentOperationStatus } from './operationProgress';

const settings = {
    games: ['game1', 'game2', 'none'],
    swissRounds: 3,
} as TournamentSettings;

const emptyData = {
    relayParticipantIds: [],
    bracketParticipantIds: [],
    swissParticipantIds: [],
    hybridParticipantIds: [],
    fullLeagueParticipantIds: [],
    doubleElimParticipantIds: [],
    teams: [],
    bracket: null,
} as unknown as TournamentData;

describe('getTournamentOperationStatus', () => {
    it('directs an unstarted mode to participant selection', () => {
        const result = getTournamentOperationStatus(emptyData, settings, 'bracket');

        expect(result.stage).toBe('참가자');
        expect(result.total).toBe(0);
        expect(result.remaining).toBe(0);
    });

    it('counts each configured relay game and matchup once', () => {
        const player = (id: string, game1Result: number | null, game2Score: number | null) => ({
            studentId: id,
            name: id,
            rank: '1급',
            game1Handicap: 0,
            game1Color: 'black' as const,
            game1Result,
            game2Score,
            game2LastStone: false,
            game3Score: null,
        });
        const data = {
            ...emptyData,
            relayParticipantIds: ['a', 'b'],
            teams: [
                { name: 'A', players: [player('a', 1, 2)] },
                { name: 'B', players: [player('b', 0, null)] },
            ],
        } as TournamentData;

        const result = getTournamentOperationStatus(data, settings, 'relay');

        expect(result).toMatchObject({ completed: 1, total: 2, remaining: 1, stage: '경기' });
    });

    it('includes ungenerated configured Swiss rounds in remaining matches', () => {
        const match = { id: 'm1', players: ['a', 'b'], winnerId: 'a' };
        const data = {
            ...emptyData,
            swissParticipantIds: ['a', 'b'],
            swiss: {
                status: 'in_progress',
                players: [],
                rounds: [[match]],
            },
        } as TournamentData;

        const result = getTournamentOperationStatus(data, settings, 'swiss');

        expect(result).toMatchObject({ completed: 1, total: 3, remaining: 2, stage: '경기' });
    });

    it('moves a completed bracket through ranking to award completion', () => {
        const data = {
            ...emptyData,
            bracketParticipantIds: ['a', 'b'],
            bracket: {
                players: [],
                rounds: [{ title: '결승', matches: [{ id: 'f', players: [null, null], winnerId: 'a' }] }],
            },
        } as TournamentData;

        expect(getTournamentOperationStatus(data, settings, 'bracket').stage).toBe('순위');
        expect(getTournamentOperationStatus(data, settings, 'bracket', 1).stage).toBe('시상');
    });
});
