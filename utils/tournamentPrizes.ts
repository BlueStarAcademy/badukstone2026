import type {
    TournamentSettings,
    TournamentBracketGroupPrizes,
    TournamentSwissGroupPrizes,
    TournamentRelayGroupPrizes,
    TournamentMissionGroupPrizes,
    SwissMatch,
    SwissPlayer,
    DoubleElimData,
} from '../types';
import { sortSwissPlayers } from './index';

export type BracketPrizeSettingsKey = 'bracket' | 'hybridBracket';

/** 시상 모달 제목용 */
export type TournamentBracketPrizeModalMode = 'bracket' | 'fullleague' | 'doubleelim' | 'hybridBracket';

export function defaultBracketGroupPrize(s: TournamentSettings): TournamentBracketGroupPrizes {
    return {
        champion: s.championPrize,
        runnerUp: s.runnerUpPrize,
        semiFinalist: s.semiFinalistPrize,
        participant: s.participantPrize,
    };
}

export const SWISS_PAID_RANK_MAX = 20;

export function parseSwissGroupSizes(s: string | undefined): number[] {
    if (!s || !String(s).trim()) return [];
    return String(s)
        .split(',')
        .map(x => parseInt(x.trim(), 10))
        .filter(n => !Number.isNaN(n) && n > 0);
}

export function getSwissPaidRankCount(settings: TournamentSettings): number {
    const n = settings.swissPaidRankCount ?? 3;
    return Math.min(SWISS_PAID_RANK_MAX, Math.max(1, Math.floor(n)));
}

/** 1위~N위 금액 배열 (길이 paidCount) */
export function getSwissRankAmounts(row: TournamentSwissGroupPrizes, paidCount: number): number[] {
    const base = [row.first ?? 0, row.second ?? 0, row.third ?? 0];
    const extra = row.extraRanks ?? [];
    const out: number[] = [];
    for (let i = 0; i < paidCount; i++) {
        if (i < 3) out.push(base[i] ?? 0);
        else out.push(extra[i - 3] ?? 0);
    }
    return out;
}

export function swissRowFromRankAmounts(amounts: number[], participant: number): TournamentSwissGroupPrizes {
    const first = amounts[0] ?? 0;
    const second = amounts[1] ?? 0;
    const third = amounts[2] ?? 0;
    const slice = amounts.slice(3);
    const row: TournamentSwissGroupPrizes = { first, second, third, participant };
    if (slice.length > 0) row.extraRanks = slice;
    return row;
}

export function defaultSwissGroupPrize(s: TournamentSettings): TournamentSwissGroupPrizes {
    const paid = getSwissPaidRankCount(s);
    const amounts: number[] = [];
    for (let i = 0; i < paid; i++) {
        if (i === 0) amounts.push(s.swiss1stPrize);
        else if (i === 1) amounts.push(s.swiss2ndPrize);
        else if (i === 2) amounts.push(s.swiss3rdPrize);
        else amounts.push(0);
    }
    return swissRowFromRankAmounts(amounts, s.participantPrize);
}

/** 조 개수에 맞게 상금 행 길이 맞춤 */
export function syncSwissPrizeRowsToGroupCount(
    rows: TournamentSwissGroupPrizes[] | undefined,
    groupCount: number,
    settings: TournamentSettings
): TournamentSwissGroupPrizes[] {
    const base = defaultSwissGroupPrize(settings);
    const list = rows && rows.length ? rows.map(r => ({ ...r })) : [];
    while (list.length < groupCount) {
        list.push({ ...(list[list.length - 1] ?? base) });
    }
    if (list.length > groupCount) list.length = groupCount;
    return list;
}

/** 스위스/예선 스타일 시상 (순위 N명 + 참가상) */
export function forEachSwissStylePayout(
    sorted: { studentId: string }[],
    prizes: TournamentSwissGroupPrizes,
    settings: TournamentSettings,
    labelPrefix: string,
    pay: (studentIds: string[], description: string, amount: number) => void
): void {
    const paid = getSwissPaidRankCount(settings);
    const amounts = getSwissRankAmounts(prizes, paid);
    for (let i = 0; i < amounts.length && i < sorted.length; i++) {
        if (amounts[i] > 0) pay([sorted[i].studentId], `${labelPrefix} ${i + 1}위`, amounts[i]);
    }
    const rest = sorted.slice(amounts.length).map(p => p.studentId);
    if (rest.length > 0 && prizes.participant > 0) pay(rest, `${labelPrefix} 참가상`, prizes.participant);
}

export function getBracketPrizeRows(settings: TournamentSettings, key: BracketPrizeSettingsKey): TournamentBracketGroupPrizes[] | undefined {
    const rows = key === 'hybridBracket' ? settings.hybridBracketPrizesByGroup : settings.bracketPrizesByGroup;
    if (rows && rows.length > 0) return rows;
    return undefined;
}

export function getBracketPrizeRow(settings: TournamentSettings, key: BracketPrizeSettingsKey, groupIndex: number): TournamentBracketGroupPrizes {
    const rows = getBracketPrizeRows(settings, key);
    if (rows) {
        return { ...rows[Math.min(Math.max(0, groupIndex), rows.length - 1)] };
    }
    return defaultBracketGroupPrize(settings);
}

export function bracketPrizeGroupCount(settings: TournamentSettings, key: BracketPrizeSettingsKey): number {
    const rows = getBracketPrizeRows(settings, key);
    return rows ? rows.length : 1;
}

export function getSwissPrizeRows(settings: TournamentSettings): TournamentSwissGroupPrizes[] | undefined {
    const rows = settings.swissPrizesByGroup;
    if (rows && rows.length > 0) return rows;
    return undefined;
}

export function getSwissPrizeRow(settings: TournamentSettings, groupIndex: number): TournamentSwissGroupPrizes {
    const rows = getSwissPrizeRows(settings);
    if (rows) {
        return { ...rows[Math.min(Math.max(0, groupIndex), rows.length - 1)] };
    }
    return defaultSwissGroupPrize(settings);
}

export function swissPrizeGroupCount(settings: TournamentSettings): number {
    const rows = getSwissPrizeRows(settings);
    return rows ? rows.length : 1;
}

export function getHybridPrelimPrizeRow(settings: TournamentSettings, groupIndex: number): TournamentSwissGroupPrizes {
    const rows = settings.hybridPrelimPrizesByGroup;
    if (rows && rows.length > 0) {
        return { ...rows[Math.min(Math.max(0, groupIndex), rows.length - 1)] };
    }
    return defaultSwissGroupPrize(settings);
}

export function hybridPrelimPrizeGroupCount(settings: TournamentSettings): number {
    const rows = settings.hybridPrelimPrizesByGroup;
    return rows && rows.length > 0 ? rows.length : 1;
}

export function getRelayPrizeRow(settings: TournamentSettings, teamIndex: number): TournamentRelayGroupPrizes {
    const rows = settings.relayPrizesByGroup;
    if (rows && rows.length > 0) {
        return { ...rows[Math.min(Math.max(0, teamIndex), rows.length - 1)] };
    }
    return {
        winPrize: settings.championPrize,
        losePrize: settings.participantPrize,
        participantPrize: settings.participantPrize,
    };
}

export function relayPrizeGroupCount(settings: TournamentSettings): number {
    const rows = settings.relayPrizesByGroup;
    return rows && rows.length > 0 ? rows.length : 2;
}

export function getMissionPrizeRow(settings: TournamentSettings, groupIndex: number): TournamentMissionGroupPrizes {
    const rows = settings.missionPrizesByGroup;
    if (rows && rows.length > 0) {
        return { ...rows[Math.min(Math.max(0, groupIndex), rows.length - 1)] };
    }
    return {
        participantPrize: settings.participantPrize,
        finishFlatBonus: 0,
    };
}

export function missionPrizeGroupCount(settings: TournamentSettings): number {
    const rows = settings.missionPrizesByGroup;
    return rows && rows.length > 0 ? rows.length : 1;
}

/** 예선 조 내 경기만 반영한 승점으로 순위 (스위스 점수 재계산) */
export function computeStandingsInPreliminaryGroup(
    groupMatches: SwissMatch[],
    allPlayers: SwissPlayer[]
): SwissPlayer[] {
    const idsInGroup = new Set<string>();
    groupMatches.forEach(m => {
        m.players.forEach(pid => {
            if (pid !== 'BYE') idsInGroup.add(pid as string);
        });
    });
    const players: SwissPlayer[] = allPlayers
        .filter(p => idsInGroup.has(p.studentId))
        .map(p => ({
            ...p,
            score: 0,
            opponents: [] as string[],
            sos: 0,
            sosos: 0,
        }));
    const pmap = new Map(players.map(p => [p.studentId, p]));
    groupMatches.forEach(m => {
        if (m.winnerId && m.winnerId !== 'BYE') {
            const w = pmap.get(m.winnerId);
            if (w) w.score += 1;
        }
    });
    return sortSwissPlayers(players, [groupMatches]);
}

export function getDoubleElimPlacements(de: DoubleElimData): {
    championId: string | null;
    runnerUpId: string | null;
    semiFinalistIds: string[];
} {
    const gf = de.grandFinal;
    if (!gf?.winnerId) {
        return { championId: null, runnerUpId: null, semiFinalistIds: [] };
    }
    const championId = gf.winnerId;
    const runnerUpId =
        (gf.players.find(p => p && p !== 'BYE' && p !== championId) as string | undefined) || null;

    const lastLR = de.losersRounds[de.losersRounds.length - 1];
    const lbFinalMatch = lastLR?.matches[0];
    const thirdId = lbFinalMatch
        ? (lbFinalMatch.players.find(p => p && p !== 'BYE' && p !== lbFinalMatch.winnerId) as string | undefined)
        : undefined;

    const lastWR = de.winnersRounds[de.winnersRounds.length - 1];
    const wbFinalMatch = lastWR?.matches[0];
    const wbLoserId = wbFinalMatch?.winnerId
        ? (wbFinalMatch.players.find(p => p && p !== 'BYE' && p !== wbFinalMatch.winnerId) as string | undefined)
        : undefined;
    const top3 = new Set([championId, runnerUpId, thirdId].filter(Boolean) as string[]);
    const fourthId = wbLoserId && !top3.has(wbLoserId) ? wbLoserId : undefined;

    const semiFinalistIds = [thirdId, fourthId].filter(Boolean) as string[];
    return { championId, runnerUpId, semiFinalistIds };
}
