import type {
    TournamentSettings,
    TournamentBracketGroupPrizes,
    TournamentSwissGroupPrizes,
    TournamentRelayGroupPrizes,
    TournamentMissionGroupPrizes,
    SwissMatch,
    SwissPlayer,
    DoubleElimData,
    TournamentBracket,
    TournamentPlayer,
} from '../types';
import { sortSwissPlayers } from './index';

export type BracketPrizeSettingsKey = 'bracket' | 'hybridBracket';

/** 시상 모달 제목용 */
export type TournamentBracketPrizeModalMode = 'bracket' | 'fullleague' | 'doubleelim' | 'hybridBracket';

/** 시상 모달·지급에 쓰는 순위별 상금 */
export interface BracketPrizePayout {
    champion: number;
    runnerUp: number;
    third: number;
    fourth: number;
    participant: number;
    /** 5위부터 */
    extraRanks: number[];
}

export const SWISS_PAID_RANK_MAX = 20;
export const BRACKET_PAID_RANK_MAX = 16;

export function getBracketPaidRankCount(settings: TournamentSettings): number {
    const n = settings.bracketPaidRankCount ?? 4;
    return Math.min(BRACKET_PAID_RANK_MAX, Math.max(1, Math.floor(n)));
}

export function getDefaultThirdPrize(s: TournamentSettings): number {
    return s.thirdPlacePrize ?? s.semiFinalistPrize ?? 0;
}

export function getDefaultFourthPrize(s: TournamentSettings): number {
    return s.fourthPlacePrize ?? s.semiFinalistPrize ?? 0;
}

/** 1위~N위 금액 배열 (길이 paidCount) */
export function getBracketRankAmounts(row: TournamentBracketGroupPrizes, paidCount: number): number[] {
    const third = row.third ?? row.semiFinalist ?? 0;
    const fourth = row.fourth ?? row.semiFinalist ?? 0;
    const base = [row.champion ?? 0, row.runnerUp ?? 0, third, fourth];
    const extra = row.extraRanks ?? [];
    const out: number[] = [];
    for (let i = 0; i < paidCount; i++) {
        if (i < 4) out.push(base[i] ?? 0);
        else out.push(extra[i - 4] ?? 0);
    }
    return out;
}

export function bracketRowFromRankAmounts(amounts: number[], participant: number): TournamentBracketGroupPrizes {
    const champion = amounts[0] ?? 0;
    const runnerUp = amounts[1] ?? 0;
    const third = amounts[2] ?? 0;
    const fourth = amounts[3] ?? 0;
    const slice = amounts.slice(4);
    const row: TournamentBracketGroupPrizes = {
        champion,
        runnerUp,
        third,
        fourth,
        semiFinalist: third,
        participant,
    };
    if (slice.length > 0) row.extraRanks = slice;
    return row;
}

export function bracketPayoutFromRow(row: TournamentBracketGroupPrizes, paidCount: number): BracketPrizePayout {
    const amounts = getBracketRankAmounts(row, Math.max(4, paidCount));
    return {
        champion: amounts[0] ?? 0,
        runnerUp: amounts[1] ?? 0,
        third: amounts[2] ?? 0,
        fourth: amounts[3] ?? 0,
        participant: row.participant ?? 0,
        extraRanks: amounts.slice(4),
    };
}

export function payoutToRankAmounts(payout: BracketPrizePayout, paidCount: number): number[] {
    const base = [payout.champion, payout.runnerUp, payout.third, payout.fourth, ...(payout.extraRanks ?? [])];
    const out: number[] = [];
    for (let i = 0; i < paidCount; i++) out.push(base[i] ?? 0);
    return out;
}

export function defaultBracketGroupPrize(s: TournamentSettings): TournamentBracketGroupPrizes {
    const paid = getBracketPaidRankCount(s);
    const extras = s.bracketExtraRankPrizes ?? [];
    const amounts: number[] = [];
    for (let i = 0; i < paid; i++) {
        if (i === 0) amounts.push(s.championPrize);
        else if (i === 1) amounts.push(s.runnerUpPrize);
        else if (i === 2) amounts.push(getDefaultThirdPrize(s));
        else if (i === 3) amounts.push(getDefaultFourthPrize(s));
        else amounts.push(extras[i - 4] ?? 0);
    }
    return bracketRowFromRankAmounts(amounts, s.participantPrize);
}

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
    const extras = s.swissExtraRankPrizes ?? [];
    const amounts: number[] = [];
    for (let i = 0; i < paid; i++) {
        if (i === 0) amounts.push(s.swiss1stPrize);
        else if (i === 1) amounts.push(s.swiss2ndPrize);
        else if (i === 2) amounts.push(s.swiss3rdPrize);
        else amounts.push(extras[i - 3] ?? 0);
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

export type RankPrizeGrant = { studentId: string; description: string; amount: number };

/** 순위 ID 배열 + 금액으로 지급 목록 생성 (참가상 포함) */
export function buildRankPrizeGrants(
    placementIds: (string | null | undefined)[],
    amounts: number[],
    participantAmount: number,
    labelPrefix: string
): RankPrizeGrant[] {
    const grants: RankPrizeGrant[] = [];
    const paid = new Set<string>();
    const rankLabel = (i: number) => {
        if (i === 0) return '우승';
        if (i === 1) return '준우승';
        return `${i + 1}위`;
    };
    for (let i = 0; i < amounts.length; i++) {
        const id = placementIds[i];
        if (!id || amounts[i] <= 0) continue;
        grants.push({ studentId: id, description: `${labelPrefix} ${rankLabel(i)}`, amount: amounts[i] });
        paid.add(id);
    }
    if (participantAmount > 0) {
        for (const id of placementIds) {
            if (!id || paid.has(id)) continue;
            grants.push({ studentId: id, description: `${labelPrefix} 참가상`, amount: participantAmount });
            paid.add(id);
        }
    }
    return grants;
}

export function buildBracketStyleGrants(
    placementIds: (string | null | undefined)[],
    payout: BracketPrizePayout,
    paidCount: number,
    labelPrefix: string
): RankPrizeGrant[] {
    return buildRankPrizeGrants(placementIds, payoutToRankAmounts(payout, paidCount), payout.participant, labelPrefix);
}

/** 싱글 엘리미네이션 순위 ID (1위~) */
export function getBracketOrderedPlacementIds(bracketData: TournamentBracket): string[] {
    const finalRound = bracketData.rounds[bracketData.rounds.length - 1];
    if (!finalRound?.matches?.[0]) return bracketData.players.map(p => p.studentId);

    const championId = finalRound.matches[0].winnerId;
    const runnerUpPlayer = finalRound.matches[0].players.find(p => p && p !== 'BYE' && p.studentId !== championId);
    const runnerUpId = runnerUpPlayer ? (runnerUpPlayer as TournamentPlayer).studentId : null;

    let thirdId: string | null = null;
    let fourthId: string | null = null;
    const semiFinalRound = bracketData.rounds.find(
        r => r.title === '4강전' || r.title === '준결승' || r.title === '4강'
    );

    if (finalRound.matches.length > 1 && finalRound.matches[1]) {
        const m = finalRound.matches[1];
        thirdId = m.winnerId;
        const fourthPlayer = m.players.find(p => p && p !== 'BYE' && p.studentId !== m.winnerId);
        fourthId = fourthPlayer ? (fourthPlayer as TournamentPlayer).studentId : null;
    } else if (semiFinalRound) {
        const losers = semiFinalRound.matches
            .flatMap(m => m.players)
            .filter(
                (p): p is TournamentPlayer =>
                    !!(p && p !== 'BYE' && p.studentId !== championId && p.studentId !== runnerUpId)
            )
            .map(p => p.studentId);
        thirdId = losers[0] ?? null;
        fourthId = losers[1] ?? null;
    }

    const top4 = new Set([championId, runnerUpId, thirdId, fourthId].filter(Boolean) as string[]);
    const rest: string[] = [];
    const finalRoundIndex = bracketData.rounds.length - 1;
    for (let ri = finalRoundIndex - 1; ri >= 0; ri--) {
        const round = bracketData.rounds[ri];
        for (const match of round.matches) {
            if (!match.winnerId) continue;
            for (const p of match.players) {
                if (p && p !== 'BYE' && (p as TournamentPlayer).studentId !== match.winnerId) {
                    const id = (p as TournamentPlayer).studentId;
                    if (!top4.has(id) && !rest.includes(id)) rest.push(id);
                }
            }
        }
    }

    const ordered = [championId, runnerUpId, thirdId, fourthId, ...rest].filter(Boolean) as string[];
    for (const p of bracketData.players) {
        if (!ordered.includes(p.studentId)) ordered.push(p.studentId);
    }
    return ordered;
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
    /** 1위부터 순서 (3·4위 분리, 이후 나머지) */
    placementIds: string[];
} {
    const decisive =
        de.grandFinalReset?.winnerId ? de.grandFinalReset : de.grandFinal;
    if (!decisive?.winnerId) {
        return { championId: null, runnerUpId: null, semiFinalistIds: [], placementIds: [...de.playerIds] };
    }
    // GF2가 없으면 GF1 기준으로 종료 판정(WB 방어)이 선행되어야 함
    if (!de.grandFinalReset?.winnerId && de.grandFinal?.winnerId === de.grandFinal.players[1]) {
        return { championId: null, runnerUpId: null, semiFinalistIds: [], placementIds: [...de.playerIds] };
    }

    const championId = decisive.winnerId;
    const runnerUpId =
        (decisive.players.find(p => p && p !== 'BYE' && p !== championId) as string | undefined) || null;

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
    const top4 = new Set([championId, runnerUpId, ...semiFinalistIds].filter(Boolean) as string[]);
    const rest = de.playerIds.filter(id => !top4.has(id));
    const placementIds = [championId, runnerUpId, thirdId, fourthId, ...rest].filter(Boolean) as string[];
    return { championId, runnerUpId, semiFinalistIds, placementIds };
}
