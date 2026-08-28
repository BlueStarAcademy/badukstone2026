import type { DoubleElimData, DoubleElimMatch, TournamentByePriority } from '../types';
import { generateId } from './index';
import { buildElimRoundOneSlotOrder, DEFAULT_BYE_PRIORITY } from './byePlacement';

function createMatch(): DoubleElimMatch {
    return { id: generateId(), players: [null, null], winnerId: null };
}

export function getLoserFromMatch(match: DoubleElimMatch, winnerId: string | null): string | null {
    if (!winnerId) return null;
    const other = match.players.find(p => p && p !== 'BYE' && p !== winnerId);
    return (other as string) || null;
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
}

export function propagateAllWinners(data: DoubleElimData) {
    const W = data.winnersRounds;
    const L = data.losersRounds;
    const GF = data.grandFinal!;
    // Derived slots are rebuilt from results so changing an upstream result cannot
    // leave an eliminated player in a later round.
    W.forEach((round, roundIndex) => round.matches.forEach((match, matchIndex) => {
        const isSixPlayerDelayedSeedMatch =
            data.playerIds.length === 6 && roundIndex === 1 && matchIndex === 1;
        if (roundIndex > 0 && !isSixPlayerDelayedSeedMatch) match.players = [null, null];
    }));
    L.forEach(round => round.matches.forEach(match => {
        match.players = [null, null];
    }));
    if (GF) GF.players = [null, null];

    for (let r = 0; r < W.length; r++) {
        for (let m = 0; m < W[r].matches.length; m++) {
            const match = W[r].matches[m];
            const winnerId = match.winnerId && match.players.includes(match.winnerId)
                ? match.winnerId
                : null;
            if (match.winnerId && !winnerId) match.winnerId = null;
            if (!winnerId) continue;
            const nextR = r + 1;
            if (nextR < W.length) {
                const nextMatch = W[nextR].matches[Math.floor(m / 2)];
                if (nextMatch) nextMatch.players[m % 2] = winnerId;
            } else if (GF) GF.players[0] = winnerId;
            const loserId = getLoserFromMatch(match, winnerId);
            if (loserId != null && r < L.length) {
                const lrMatchIdx = r === 0 ? Math.floor(m / 2) : Math.min(m, L[r].matches.length - 1);
                const lrSlot = r === 0 ? m % 2 : 0;
                if (r > 0 && L[r].matches.length === 1 && m > 0) continue;
                if (lrMatchIdx >= 0 && L[r].matches[lrMatchIdx]) L[r].matches[lrMatchIdx].players[lrSlot] = loserId;
            }
        }
    }
    for (let r = 0; r < L.length; r++) {
        for (let m = 0; m < L[r].matches.length; m++) {
            const match = L[r].matches[m];
            const winnerId = match.winnerId && match.players.includes(match.winnerId)
                ? match.winnerId
                : null;
            if (match.winnerId && !winnerId) match.winnerId = null;
            if (!winnerId) continue;
            const nextR = r + 1;
            if (nextR < L.length) {
                const nextRound = L[nextR].matches;
                const nextIdx = nextRound.length === 1 ? 0 : m;
                const slot = nextRound.length === 1 && m > 0 ? -1 : 1;
                if (nextRound[nextIdx] && slot >= 0) nextRound[nextIdx].players[slot] = winnerId;
            } else if (GF) GF.players[1] = winnerId;
        }
    }
}

/**
 * participantIds: 급수 순 등 **최강이 앞**인 배열.
 */
export function buildDoubleElim(participantIds: string[], priority: TournamentByePriority = DEFAULT_BYE_PRIORITY): DoubleElimData {
    const n = participantIds.length;
    const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);

    if (n === 6) {
        const ids = [...participantIds];
        let r1four: string[];
        let delayed: [string, string];
        if (priority === 'min_matches') {
            delayed = [ids[0], ids[1]];
            r1four = ids.slice(2);
        } else if (priority === 'max_matches') {
            delayed = [ids[4], ids[5]];
            r1four = ids.slice(0, 4);
        } else {
            delayed = [ids[2], ids[3]];
            r1four = [ids[0], ids[1], ids[4], ids[5]];
        }
        const shuffled = shuffle(r1four);
        const winnersRounds: { title: string; matches: DoubleElimMatch[] }[] = [];
        const losersRounds: { title: string; matches: DoubleElimMatch[] }[] = [];

        const r1m0 = createMatch();
        r1m0.players = [shuffled[0], shuffled[1]];
        const r1m1 = createMatch();
        r1m1.players = [shuffled[2], shuffled[3]];
        winnersRounds.push({ title: '4강', matches: [r1m0, r1m1] });

        const r2m0 = createMatch();
        r2m0.players = [null, null];
        const r2m1 = createMatch();
        r2m1.players = [delayed[0], delayed[1]];
        winnersRounds.push({ title: '승자 결승', matches: [r2m0, r2m1] });

        const r3m0 = createMatch();
        r3m0.players = [null, null];
        winnersRounds.push({ title: '승자 결승', matches: [r3m0] });

        losersRounds.push({ title: '패자조 R1', matches: [createMatch()] });
        losersRounds.push({ title: '패자조 R2', matches: [createMatch()] });

        const grandFinal = createMatch();
        const built: DoubleElimData = { winnersRounds, losersRounds, grandFinal, playerIds: participantIds };
        applyByeWinners(built);
        propagateAllWinners(built);
        return built;
    }

    const { slots: shuffled } = buildElimRoundOneSlotOrder(participantIds, priority, true);
    const size = shuffled.length;
    const half = size / 2;

    const winnersRounds: { title: string; matches: DoubleElimMatch[] }[] = [];
    const losersRounds: { title: string; matches: DoubleElimMatch[] }[] = [];

    let prevMatches: DoubleElimMatch[] = [];
    for (let i = 0; i < half; i++) {
        const m = createMatch();
        m.players = [shuffled[i * 2], shuffled[i * 2 + 1]];
        if (m.players[0] === 'BYE') m.winnerId = m.players[1] as string;
        else if (m.players[1] === 'BYE') m.winnerId = m.players[0] as string;
        prevMatches.push(m);
    }
    const firstTitle = size === 2 ? '결승' : size === 4 ? '준결승' : `${size}강`;
    winnersRounds.push({ title: firstTitle, matches: prevMatches });

    let roundSize = half;
    while (roundSize > 1) {
        const nextMatches: DoubleElimMatch[] = [];
        for (let i = 0; i < roundSize / 2; i++) nextMatches.push(createMatch());
        winnersRounds.push({
            title: roundSize === 2 ? '승자 결승' : `${roundSize}강`,
            matches: nextMatches,
        });
        prevMatches = nextMatches;
        roundSize = roundSize / 2;
    }

    const numWRounds = winnersRounds.length;
    for (let lr = 0; lr < numWRounds; lr++) {
        const wCount = winnersRounds[lr].matches.length;
        const matchCount = lr === 0 ? Math.max(1, Math.floor(wCount / 2)) : Math.max(1, wCount);
        const lm: DoubleElimMatch[] = [];
        for (let i = 0; i < matchCount; i++) lm.push(createMatch());
        losersRounds.push({ title: `패자조 R${lr + 1}`, matches: lm });
    }

    const grandFinal = createMatch();
    const built: DoubleElimData = { winnersRounds, losersRounds, grandFinal, playerIds: participantIds };
    applyByeWinners(built);
    propagateAllWinners(built);
    return built;
}
