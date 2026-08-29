import type { DoubleElimData, DoubleElimMatch, TournamentByePriority } from '../types';
import { generateId } from './index';
import {
    DEFAULT_BYE_PRIORITY,
    planCompactElimBracket,
    pickByeRecipientSeedIndices,
} from './byePlacement';
import { isPlayInRoundTitle, playInFeederTarget, standardFeederTarget } from './elimBracket';

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

function winnersRoundHasPlayIn(data: DoubleElimData): boolean {
    return !!data.winnersRounds[0] && isPlayInRoundTitle(data.winnersRounds[0].title);
}

export function propagateAllWinners(data: DoubleElimData) {
    const W = data.winnersRounds;
    const L = data.losersRounds;
    const GF = data.grandFinal!;
    const playInFirst = winnersRoundHasPlayIn(data);

    // Derived slots are rebuilt from results so changing an upstream result cannot
    // leave an eliminated player in a later round.
    W.forEach((round, roundIndex) =>
        round.matches.forEach((match, matchIndex) => {
            const isSixPlayerDelayedSeedMatch =
                data.playerIds.length === 6 && roundIndex === 1 && matchIndex === 1;
            if (roundIndex > 0 && !isSixPlayerDelayedSeedMatch) {
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

    // 본선(승자 R1) 부전승 시드가 wipe되지 않도록, play-in 구조에서는 R1의
    // bye-bye 매치 플레이어를 최초 배치 값으로 다시 채울 수 없어 생성 시 시드를
    // playerIds 메타로 복구한다.
    if (playInFirst && data.mainDrawByeSeeds && W[1]) {
        const seeds = [...data.mainDrawByeSeeds];
        const playInCount = W[0].matches.length;
        for (let i = 0; i < W[1].matches.length; i++) {
            if (i < playInCount) {
                W[1].matches[i].players[0] = seeds.shift() ?? null;
            } else {
                W[1].matches[i].players[0] = seeds.shift() ?? null;
                W[1].matches[i].players[1] = seeds.shift() ?? null;
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
                    playInFirst && r === 0 ? playInFeederTarget(m, W[0].matches.length) : standardFeederTarget(m);
                const nextMatch = W[nextR].matches[nextMatchTarget.matchIndex];
                if (nextMatch) nextMatch.players[nextMatchTarget.slot] = winnerId;
            } else if (GF) GF.players[0] = winnerId;

            const loserId = getLoserFromMatch(match, winnerId);
            if (loserId != null && r < L.length) {
                const lrMatchIdx = r === 0 ? Math.floor(m / 2) : Math.min(m, L[r].matches.length - 1);
                const lrSlot = r === 0 ? m % 2 : 0;
                if (r > 0 && L[r].matches.length === 1 && m > 0) continue;
                if (lrMatchIdx >= 0 && L[r].matches[lrMatchIdx]) {
                    L[r].matches[lrMatchIdx].players[lrSlot] = loserId;
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
export function buildDoubleElim(
    participantIds: string[],
    priority: TournamentByePriority = DEFAULT_BYE_PRIORITY
): DoubleElimData {
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

    const { mainDrawSize, playInMatchCount, byeCount } = planCompactElimBracket(n);
    const byeIdx = new Set(pickByeRecipientSeedIndices(n, byeCount, priority));
    const byeRecipients: string[] = [];
    const playInPlayers: string[] = [];
    participantIds.forEach((id, i) => {
        (byeIdx.has(i) ? byeRecipients : playInPlayers).push(id);
    });

    const winnersRounds: { title: string; matches: DoubleElimMatch[] }[] = [];
    const losersRounds: { title: string; matches: DoubleElimMatch[] }[] = [];
    let mainDrawByeSeeds: string[] | undefined;

    if (playInMatchCount > 0) {
        const shuffled = shuffle(playInPlayers);
        const playInMatches: DoubleElimMatch[] = [];
        for (let i = 0; i < playInMatchCount; i++) {
            const m = createMatch();
            m.players = [shuffled[i * 2], shuffled[i * 2 + 1]];
            playInMatches.push(m);
        }
        winnersRounds.push({
            title: `예선 (${playInMatchCount}경기 → ${mainDrawSize}강)`,
            matches: playInMatches,
        });

        const mainMatches: DoubleElimMatch[] = [];
        const byeQueue = [...byeRecipients];
        mainDrawByeSeeds = [...byeRecipients];
        for (let i = 0; i < mainDrawSize / 2; i++) {
            const m = createMatch();
            if (i < playInMatchCount) {
                m.players = [byeQueue.shift() ?? null, null];
            } else {
                m.players = [byeQueue.shift() ?? null, byeQueue.shift() ?? null];
            }
            mainMatches.push(m);
        }
        winnersRounds.push({
            title: mainDrawSize === 4 ? '준결승' : `${mainDrawSize}강`,
            matches: mainMatches,
        });
    } else {
        const shuffled = shuffle(playInPlayers);
        const firstMatches: DoubleElimMatch[] = [];
        for (let i = 0; i < mainDrawSize / 2; i++) {
            const m = createMatch();
            m.players = [shuffled[i * 2], shuffled[i * 2 + 1]];
            firstMatches.push(m);
        }
        const firstTitle =
            mainDrawSize === 2 ? '결승' : mainDrawSize === 4 ? '준결승' : `${mainDrawSize}강`;
        winnersRounds.push({ title: firstTitle, matches: firstMatches });
    }

    let roundSize = mainDrawSize / 2;
    while (roundSize > 1) {
        const nextMatches: DoubleElimMatch[] = [];
        for (let i = 0; i < roundSize / 2; i++) nextMatches.push(createMatch());
        winnersRounds.push({
            title: roundSize === 2 ? '승자 결승' : `${roundSize}강`,
            matches: nextMatches,
        });
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
    const built: DoubleElimData = {
        winnersRounds,
        losersRounds,
        grandFinal,
        playerIds: participantIds,
        mainDrawByeSeeds,
    };
    applyByeWinners(built);
    propagateAllWinners(built);
    return built;
}
