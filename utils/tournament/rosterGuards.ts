import type { TournamentData, TournamentSettings } from '../../types';
import { parseSwissGroupSizes } from '../tournamentPrizes';

export type TournamentRosterMode =
    | 'relay'
    | 'bracket'
    | 'swiss'
    | 'hybrid'
    | 'fullleague'
    | 'doubleelim'
    | 'mission';

/** 해당 모드에 활성 대진/진행 데이터가 있는지 */
export function hasActiveTournamentDraw(data: TournamentData, mode: TournamentRosterMode): boolean {
    switch (mode) {
        case 'relay':
            return (data.teams || []).some(team => (team.players?.length || 0) > 0);
        case 'bracket':
            return !!data.bracket;
        case 'swiss':
            return !!data.swiss;
        case 'hybrid':
            return !!data.hybrid;
        case 'fullleague':
            return !!data.fullLeague;
        case 'doubleelim':
            return !!data.doubleElim;
        case 'mission':
            return !!(data.missionBaduk && data.missionBaduk.players.length > 0);
        default:
            return false;
    }
}

/** 참가자 ID는 유지한 채 대진/진행만 제거 */
export function clearTournamentDraw(data: TournamentData, mode: TournamentRosterMode): TournamentData {
    switch (mode) {
        case 'relay':
            return {
                ...data,
                teams: [
                    { name: 'A', players: [], mannerPenalties: 0, bonusScore: 0 },
                    { name: 'B', players: [], mannerPenalties: 0, bonusScore: 0 },
                ],
            };
        case 'bracket':
            return { ...data, bracket: null };
        case 'swiss':
            return { ...data, swiss: undefined };
        case 'hybrid':
            return { ...data, hybrid: undefined };
        case 'fullleague':
            return { ...data, fullLeague: undefined };
        case 'doubleelim':
            return { ...data, doubleElim: undefined };
        case 'mission':
            return { ...data, missionBaduk: undefined };
        default:
            return data;
    }
}

export function getSwissGroupReadiness(
    settings: TournamentSettings | undefined,
    participantCount: number
): { ok: boolean; useGroups: boolean; sum: number; sizes: number[] } {
    const useGroups = settings?.swissUseGroups === true;
    if (!useGroups) {
        return { ok: participantCount >= 2, useGroups: false, sum: 0, sizes: [] };
    }
    const sizes = parseSwissGroupSizes(settings?.swissGroupSizes);
    const sum = sizes.reduce((a, b) => a + b, 0);
    return {
        ok: sizes.length > 0 && sum === participantCount && participantCount >= 2,
        useGroups: true,
        sum,
        sizes,
    };
}
