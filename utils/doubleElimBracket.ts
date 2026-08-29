import type { DoubleElimData, DoubleElimMatch, TournamentByePriority } from '../types';
import { generateId } from './index';
import {
    DEFAULT_BYE_PRIORITY,
    planDoubleElimBracket,
    pairSeedsWithByePads,
} from './byePlacement';
import { elimRoundTitle, isPlayInRoundTitle, playInFeederTarget, standardFeederTarget } from './elimBracket';

function createMatch(): DoubleElimMatch {
    return { id: generateId(), players: [null, null], winnerId: null };
}

export function getLoserFromMatch(match: DoubleElimMatch, winnerId: string | null): string | null {
    if (!winnerId) return null;
    const other = match.players.find(p => p && p !== 'BYE' && p !== winnerId);
    return (other as string) || null;
}

/** WB 우승자가 GF1을 지키면 종료, LB가 이기면 GF2(리셋) 필요 */
export function isDoubleElimComplete(data: DoubleElimData): boolean {
    const gf = data.grandFinal;
    if (!gf?.winnerId) return false;
    const wbChamp = gf.players[0];
    const lbChamp = gf.players[1];
    if (gf.winnerId === wbChamp) return true;
    if (gf.winnerId === lbChamp) return !!data.grandFinalReset?.winnerId;
    return !!gf.winnerId;
}

/** 최종 우승 매치 (GF2가 치러졌으면 그것, 아니면 GF1) */
export function getDecisiveGrandFinal(data: DoubleElimData): DoubleElimMatch | null {
    if (data.grandFinalReset?.winnerId) return data.grandFinalReset;
    return data.grandFinal;
}

/** 명시적인 BYE 상대일 때만 자동 승리시킨다. null은 아직 미정인 진출자다. */
export function applyByeWinners(data: DoubleElimData) {
    const setIfBye = (match: DoubleElimMatch) => {
        const a = match.players[0];
        const b = match.players[1];
        const onlyA = a && a !== 'BYE' && b === 'BYE';
        const onlyB = b && b !== 'BYE' && a === 'BYE';
        if (onlyA) match.winnerId = a as string;
        else if (onlyB) match.winnerId = b as string;
    };
    data.winnersRounds.forEach(r => r.matches.forEach(setIfBye));
    data.losersRounds.forEach(r => r.matches.forEach(setIfBye));
    if (data.grandFinal) setIfBye(data.grandFinal);
    if (data.grandFinalReset) setIfBye(data.grandFinalReset);
}

function winnersRoundHasPlayIn(data: DoubleElimData): boolean {
    return !!data.winnersRounds[0] && isPlayInRoundTitle(data.winnersRounds[0].title);
}

/** 본선 크기(2^n) 기준 표준 패자조 라운드 수·매치 수 */
export function buildLosersRoundsForMainDraw(mainDrawSize: number): { title: string; matches: DoubleElimMatch[] }[] {
    if (mainDrawSize < 4 || !Number.isInteger(Math.log2(mainDrawSize))) return [];
    const numRounds = 2 * Math.log2(mainDrawSize) - 2;
    const rounds: { title: string; matches: DoubleElimMatch[] }[] = [];
    let matchCount = mainDrawSize / 4;
    for (let i = 0; i < numRounds; i++) {
        const matches: DoubleElimMatch[] = [];
        for (let m = 0; m < matchCount; m++) matches.push(createMatch());
        rounds.push({ title: `패자조 R${i + 1}`, matches });
        if (i % 2 === 1) matchCount = Math.max(1, matchCount / 2);
    }
    return rounds;
}

function placeLoserOrBye(
    match: DoubleElimMatch | undefined,
    slot: 0 | 1,
    loserId: string | null,
    sourceCompleteWithNoLoser: boolean
) {
    if (!match) return;
    if (loserId) match.players[slot] = loserId;
    else if (sourceCompleteWithNoLoser) match.players[slot] = 'BYE';
}

export function propagateAllWinners(data: DoubleElimData) {
    // BYE 자동승이 연쇄로 다음 라운드를 채우도록 소횟수 반복
    for (let pass = 0; pass < 12; pass++) {
        const fingerprint = doubleElimWinnerFingerprint(data);
        propagateAllWinnersOnce(data);
        applyByeWinners(data);
        if (doubleElimWinnerFingerprint(data) === fingerprint) break;
    }
}

function doubleElimWinnerFingerprint(data: DoubleElimData): string {
    const parts: string[] = [];
    const push = (m: DoubleElimMatch | null | undefined) => {
        if (!m) return;
        parts.push(`${m.winnerId ?? ''}:${m.players[0] ?? ''}:${m.players[1] ?? ''}`);
    };
    data.winnersRounds.forEach(r => r.matches.forEach(push));
    data.losersRounds.forEach(r => r.matches.forEach(push));
    push(data.grandFinal ?? undefined);
    push(data.grandFinalReset ?? undefined);
    return parts.join('|');
}

function propagateAllWinnersOnce(data: DoubleElimData) {
    const W = data.winnersRounds;
    const L = data.losersRounds;
    const GF = data.grandFinal;
    const GF2 = data.grandFinalReset;
    const playInFirst = winnersRoundHasPlayIn(data);
    const mainStart = playInFirst ? 1 : 0;
    const mainDrawSize = playInFirst
        ? (W[1]?.matches.length ?? 0) * 2
        : (W[0]?.matches.length ?? 0) * 2;

    W.forEach((round, roundIndex) =>
        round.matches.forEach(match => {
            if (roundIndex > 0) {
                match.players = [null, null];
            }
        })
    );
    L.forEach(round =>
        round.matches.forEach(match => {
            match.players = [null, null];
        })
    );
    if (GF) GF.players = [null, null];
    if (GF2) GF2.players = [null, null];

    if (playInFirst && data.mainDrawByeSeeds && W[1]) {
        const seeds = [...data.mainDrawByeSeeds];
        const byeCount = seeds.length;
        for (let i = 0; i < W[1].matches.length; i++) {
            if (i < byeCount) {
                W[1].matches[i].players[0] = seeds.shift() ?? null;
            } else {
                W[1].matches[i].players[0] = null;
                W[1].matches[i].players[1] = null;
            }
        }
    }

    for (let r = 0; r < W.length; r++) {
        for (let m = 0; m < W[r].matches.length; m++) {
            const match = W[r].matches[m];
            const winnerId =
                match.winnerId && match.players.includes(match.winnerId) ? match.winnerId : null;
            if (match.winnerId && !winnerId) match.winnerId = null;
            if (!winnerId) continue;

            const nextR = r + 1;
            if (nextR < W.length) {
                const nextMatchTarget =
                    playInFirst && r === 0
                        ? playInFeederTarget(m, W[0].matches.length, mainDrawSize)
                        : standardFeederTarget(m);
                const nextMatch = W[nextR].matches[nextMatchTarget.matchIndex];
                if (nextMatch) nextMatch.players[nextMatchTarget.slot] = winnerId;
            } else if (GF) {
                GF.players[0] = winnerId;
            }

            const loserId = getLoserFromMatch(match, winnerId);
            const noLoser = !loserId;

            if (playInFirst && r === 0) continue;
            if (L.length === 0) continue;

            const mainRound = r - mainStart;
            if (mainRound < 0) continue;

            if (mainRound === 0) {
                const lrMatchIdx = Math.floor(m / 2);
                const lrSlot = (m % 2) as 0 | 1;
                placeLoserOrBye(L[0]?.matches[lrMatchIdx], lrSlot, loserId, noLoser);
            } else {
                const lr = 2 * mainRound - 1;
                if (lr < L.length && L[lr]?.matches[m]) {
                    placeLoserOrBye(L[lr].matches[m], 1, loserId, noLoser);
                }
            }
        }
    }

    for (let r = 0; r < L.length; r++) {
        for (let m = 0; m < L[r].matches.length; m++) {
            const match = L[r].matches[m];
            const winnerId =
                match.winnerId && match.players.includes(match.winnerId) ? match.winnerId : null;
            if (match.winnerId && !winnerId) match.winnerId = null;
            if (!winnerId) continue;
            const nextR = r + 1;
            if (nextR >= L.length) {
                if (GF) GF.players[1] = winnerId;
                continue;
            }
            const nextRound = L[nextR].matches;
            if (r % 2 === 0) {
                if (nextRound[m]) nextRound[m].players[0] = winnerId;
            } else {
                const target = standardFeederTarget(m);
                if (nextRound[target.matchIndex]) {
                    nextRound[target.matchIndex].players[target.slot] = winnerId;
                }
            }
        }
    }

    if (GF && GF2) {
        const wb = GF.players[0];
        const lb = GF.players[1];
        if (GF.winnerId && wb && lb && GF.winnerId === lb) {
            GF2.players = [wb, lb];
            if (GF2.winnerId && !GF2.players.includes(GF2.winnerId)) GF2.winnerId = null;
        } else {
            GF2.winnerId = null;
        }
    }
}

function pairWithByePads(
    playerIds: string[],
    mainDrawSize: number,
    priority: TournamentByePriority,
    shuffleRemaining: boolean
): DoubleElimMatch[] {
    const paired = pairSeedsWithByePads(playerIds, mainDrawSize, priority, shuffleRemaining);
    return paired.map(([a, b]) => {
        const m = createMatch();
        m.players = [a, b];
        return m;
    });
}

/**
 * participantIds: 급수 순 등 **최강이 앞**인 배열.
 * @param forcedMainDrawSize 승자조 몇강부터 (2의 거듭제곱, ≥인원). 미지정 시 다음 2^n.
 */
export function buildDoubleElim(
    participantIds: string[],
    priority: TournamentByePriority = DEFAULT_BYE_PRIORITY,
    forcedMainDrawSize?: number | null
): DoubleElimData {
    const { mainDrawSize } = planDoubleElimBracket(participantIds.length, forcedMainDrawSize);

    const winnersRounds: { title: string; matches: DoubleElimMatch[] }[] = [];
    const firstMatches = pairWithByePads(participantIds, mainDrawSize, priority, true);
    winnersRounds.push({ title: elimRoundTitle(mainDrawSize), matches: firstMatches });

    let roundSize = mainDrawSize / 2;
    while (roundSize > 1) {
        const nextMatches: DoubleElimMatch[] = [];
        for (let i = 0; i < roundSize / 2; i++) nextMatches.push(createMatch());
        winnersRounds.push({
            title: roundSize === 2 ? '승자 결승' : elimRoundTitle(roundSize),
            matches: nextMatches,
        });
        roundSize = roundSize / 2;
    }

    const built: DoubleElimData = {
        winnersRounds,
        losersRounds: buildLosersRoundsForMainDraw(mainDrawSize),
        grandFinal: createMatch(),
        grandFinalReset: createMatch(),
        playerIds: participantIds,
    };
    applyByeWinners(built);
    propagateAllWinners(built);
    return built;
}
