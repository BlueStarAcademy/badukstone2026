import type { TournamentByePriority } from '../types';

export const DEFAULT_BYE_PRIORITY: TournamentByePriority = 'min_byes';

export function minimalPow2BracketSize(n: number): number {
    return Math.pow(2, Math.ceil(Math.log2(Math.max(2, n))));
}

/** 직전 2의 거듭제곱 (예: 20 → 16) */
export function previousPow2BracketSize(n: number): number {
    if (n <= 2) return 2;
    const next = minimalPow2BracketSize(n);
    return next === n ? n : next / 2;
}

/**
 * 인원수에 맞는 최적 단판 구조.
 * - 2^n명이면 그대로 본선
 * - 아니면 직전 2^n(예: 20→16강)으로 들어가는 예선 + 부전승
 */
export function planCompactElimBracket(n: number): {
    mainDrawSize: number;
    playInMatchCount: number;
    byeCount: number;
} {
    const count = Math.max(0, n);
    if (count <= 1) {
        return { mainDrawSize: 2, playInMatchCount: 0, byeCount: 0 };
    }
    const next = minimalPow2BracketSize(count);
    if (next === count) {
        return { mainDrawSize: count, playInMatchCount: 0, byeCount: 0 };
    }
    const mainDrawSize = previousPow2BracketSize(count);
    const playInMatchCount = count - mainDrawSize;
    const byeCount = mainDrawSize - playInMatchCount;
    return { mainDrawSize, playInMatchCount, byeCount };
}

/**
 * 단판/예선 본선 등: 시드 순서에서 부전승을 받을 B명의 인덱스(0 = 최강).
 * - min_byes: 부전승 대상을 순위 전체에 고르게 퍼뜨림.
 * - min_matches: 상위 시드가 부전승을 받아 강자의 실제 대국(판) 수를 줄임.
 * - max_matches: 하위 시드가 부전승을 받아 상위끼리 맞붙을 확률을 높임.
 */
export function pickByeRecipientSeedIndices(n: number, numByes: number, priority: TournamentByePriority): number[] {
    const B = Math.min(Math.max(0, numByes), n);
    if (B <= 0) return [];
    if (priority === 'min_matches') {
        return Array.from({ length: B }, (_, i) => i);
    }
    if (priority === 'max_matches') {
        return Array.from({ length: B }, (_, i) => n - B + i);
    }
    const set = new Set<number>();
    for (let i = 0; i < B; i++) {
        const idx = Math.floor(((i + 0.5) / B) * n);
        set.add(Math.min(Math.max(0, idx), n - 1));
    }
    let k = 0;
    while (set.size < B && k < n) {
        if (!set.has(k)) set.add(k);
        k++;
    }
    return [...set].sort((a, b) => a - b);
}

/**
 * 토너먼트 1라운드(예선) 슬롯.
 * - 2^n명: 전원 대진, bracketSize = n
 * - 그 외: 직전 2^n 본선으로 가는 예선만 반환 (부전승 시드는 byeRecipients)
 *   예: 20명 → bracketSize 16, 예선 4경기(8명), 부전승 12명
 */
export function buildElimRoundOneSlotOrder<T>(
    seedsStrongestFirst: T[],
    priority: TournamentByePriority,
    shuffleRemainingPairings: boolean
): { bracketSize: number; slots: (T | 'BYE')[]; playInMatchCount: number; byeRecipients: T[] } {
    const n = seedsStrongestFirst.length;
    const { mainDrawSize, playInMatchCount, byeCount } = planCompactElimBracket(n);
    const byeIdx = new Set(pickByeRecipientSeedIndices(n, byeCount, priority));
    const byeRecipients: T[] = [];
    const playIn: T[] = [];
    seedsStrongestFirst.forEach((p, i) => {
        (byeIdx.has(i) ? byeRecipients : playIn).push(p);
    });
    const pvp = shuffleRemainingPairings ? [...playIn].sort(() => Math.random() - 0.5) : [...playIn];

    if (playInMatchCount === 0) {
        const slots: (T | 'BYE')[] = [];
        for (let i = 0; i < pvp.length; i += 2) {
            slots.push(pvp[i], pvp[i + 1]);
        }
        return { bracketSize: mainDrawSize, slots, playInMatchCount: 0, byeRecipients: [] };
    }

    const slots: (T | 'BYE')[] = [];
    for (let i = 0; i < pvp.length; i += 2) {
        slots.push(pvp[i], pvp[i + 1] ?? ('BYE' as const));
    }
    return { bracketSize: mainDrawSize, slots, playInMatchCount, byeRecipients };
}

/** 스위스 1라운드·홀수 명: orderedPool[0]이 최강일 때 부전승으로 뺄 인덱스 */
export function pickSwissOddByePoolIndex(poolLength: number, priority: TournamentByePriority): number {
    if (poolLength <= 0) return 0;
    if (priority === 'min_matches') return 0;
    if (priority === 'max_matches') return poolLength - 1;
    return Math.floor(poolLength / 2);
}

/**
 * 스코어 내림차순 정렬된 선수 목록에서, 이번 라운드 부전승 줄 인덱스.
 * (동점 내 순서는 이미 섞인 상태로 넘어옴)
 */
export function pickSwissByeSortedIndex(sortedScoreDesc: { opponents: string[] }[], priority: TournamentByePriority): number {
    const eligible: number[] = [];
    for (let i = 0; i < sortedScoreDesc.length; i++) {
        if (!sortedScoreDesc[i].opponents.includes('BYE')) eligible.push(i);
    }
    if (eligible.length === 0) return sortedScoreDesc.length - 1;
    if (priority === 'max_matches') return eligible[eligible.length - 1];
    if (priority === 'min_matches') return eligible[0];
    return eligible[Math.floor(eligible.length / 2)];
}
