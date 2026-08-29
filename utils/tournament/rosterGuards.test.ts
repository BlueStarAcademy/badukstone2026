import { describe, expect, it } from 'vitest';
import type { TournamentData, TournamentSettings } from '../../types';
import {
    clearTournamentDraw,
    getSwissGroupReadiness,
    hasActiveTournamentDraw,
} from './rosterGuards';

const emptyData = (): TournamentData =>
    ({
        teams: [
            { name: 'A', players: [], mannerPenalties: 0, bonusScore: 0 },
            { name: 'B', players: [], mannerPenalties: 0, bonusScore: 0 },
        ],
    }) as TournamentData;

describe('rosterGuards', () => {
    it('detects active draws per mode', () => {
        const data = emptyData();
        expect(hasActiveTournamentDraw(data, 'bracket')).toBe(false);
        data.bracket = { rounds: [], players: [] } as TournamentData['bracket'];
        expect(hasActiveTournamentDraw(data, 'bracket')).toBe(true);
        data.swiss = { status: 'in_progress', players: [], rounds: [] };
        expect(hasActiveTournamentDraw(data, 'swiss')).toBe(true);
        data.missionBaduk = { players: [{ studentId: 'a', name: 'a', status: 'waiting', score: 0, matches: [], prizeGroupIndex: 0 }] };
        expect(hasActiveTournamentDraw(data, 'mission')).toBe(true);
    });

    it('clears draw while leaving other modes intact', () => {
        const data = emptyData();
        data.bracket = { rounds: [], players: [] } as TournamentData['bracket'];
        data.swiss = { status: 'in_progress', players: [], rounds: [] };
        data.swissParticipantIds = ['a', 'b'];
        const cleared = clearTournamentDraw(data, 'bracket');
        expect(cleared.bracket).toBeNull();
        expect(cleared.swiss).toBeTruthy();
        expect(cleared.swissParticipantIds).toEqual(['a', 'b']);
    });

    it('clears mission draw without touching participant ids', () => {
        const data = emptyData();
        data.missionParticipantIds = ['a', 'b'];
        data.missionBaduk = {
            players: [{ studentId: 'a', name: 'a', status: 'waiting', score: 0, matches: [], prizeGroupIndex: 0 }],
        };
        const cleared = clearTournamentDraw(data, 'mission');
        expect(cleared.missionBaduk).toBeUndefined();
        expect(cleared.missionParticipantIds).toEqual(['a', 'b']);
    });

    it('validates swiss group size sum', () => {
        const settings = {
            swissUseGroups: true,
            swissGroupSizes: '4,4',
        } as TournamentSettings;
        expect(getSwissGroupReadiness(settings, 8)).toMatchObject({ ok: true, sum: 8 });
        expect(getSwissGroupReadiness(settings, 7)).toMatchObject({ ok: false, sum: 8 });
        expect(getSwissGroupReadiness({ swissUseGroups: false } as TournamentSettings, 3)).toMatchObject({
            ok: true,
            useGroups: false,
        });
        expect(getSwissGroupReadiness({ swissUseGroups: false } as TournamentSettings, 1)).toMatchObject({
            ok: false,
        });
    });
});
