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

export function isPowerOfTwo(n: number): boolean {
    return Number.isInteger(n) && n >= 2 && (n & (n - 1)) === 0;
}

/**
 * 강제 본선 크기(몇강) 반영.
 * - S >= n: 예선 없이 본선 S강, 빈 자리는 부전승
 * - S < n && 2S >= n: 예선 (n-S)경기 → S강
 * - 그 외/무효: 자동(compact) 계획
 */
export function planElimBracket(
    n: number,
    forcedMainDrawSize?: number | null
): {
    mainDrawSize: number;
    playInMatchCount: number;
    byeCount: number;
} {
    const count = Math.max(0, n);
    if (!forcedMainDrawSize || !isPowerOfTwo(forcedMainDrawSize)) {
        return planCompactElimBracket(count);
    }
    const size = forcedMainDrawSize;
    if (size >= count) {
        return { mainDrawSize: size, playInMatchCount: 0, byeCount: size - count };
    }
    if (2 * size >= count) {
        const playInMatchCount = count - size;
        const byeCount = size - playInMatchCount;
        return { mainDrawSize: size, playInMatchCount, byeCount };
    }
    return planCompactElimBracket(count);
}

/** 선수 수에 대해 선택 가능한 몇강 목록 (자동 제외). 상한은 다음 2^n까지. */
export function listValidStartRoundSizes(playerCount: number): number[] {
    const n = Math.max(0, playerCount);
    if (n < 2) return [];
    const maxSize = Math.max(minimalPow2BracketSize(n), 4);
    const sizes: number[] = [];
    for (let size = 4; size <= maxSize; size *= 2) {
        if (size >= n || 2 * size >= n) sizes.push(size);
    }
    if (n === 2 && !sizes.includes(2)) sizes.unshift(2);
    return sizes;
}

export function formatStartRoundLabel(size: number): string {
    if (size <= 2) return '결승';
    if (size === 4) return '4강전';
    return `${size}강`;
}

/** 선택한 몇강 계획의 짧은 설명 (부전승·예선 수) */
export function describeElimBracketPlan(
    playerCount: number,
    forcedMainDrawSize?: number | null
): string {
    const n = Math.max(0, playerCount);
    if (n < 2) return '';
    const { mainDrawSize, playInMatchCount, byeCount } = planElimBracket(n, forcedMainDrawSize);
    const label = formatStartRoundLabel(mainDrawSize);
    if (playInMatchCount > 0) {
        return `예선 ${playInMatchCount}경기 → ${label}` + (byeCount > 0 ? `, 부전승 ${byeCount}` : '');
    }
    if (byeCount > 0) return `${label} · 부전승 ${byeCount}`;
    return `${label} 본선`;
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
    shuffleRemainingPairings: boolean,
    forcedMainDrawSize?: number | null
): { bracketSize: number; slots: (T | 'BYE')[]; playInMatchCount: number; byeRecipients: T[] } {
    const n = seedsStrongestFirst.length;
    const { mainDrawSize, playInMatchCount, byeCount } = planElimBracket(n, forcedMainDrawSize);

    // 본선만 (예선 없음): 전원 배치 후 빈 자리는 부전승 패딩
    if (playInMatchCount === 0) {
        const queue = shuffleRemainingPairings
            ? [...seedsStrongestFirst].sort(() => Math.random() - 0.5)
            : [...seedsStrongestFirst];
        const byePads = Math.max(0, mainDrawSize - queue.length);
        const paired: (T | 'BYE')[][] = [];
        for (let i = 0; i < byePads; i++) {
            const player = queue.shift();
            if (player) paired.push([player, 'BYE']);
            else paired.push(['BYE', 'BYE']);
        }
        while (queue.length > 0) {
            paired.push([queue.shift()!, queue.shift() ?? ('BYE' as const)]);
        }
        while (paired.length < mainDrawSize / 2) {
            paired.push(['BYE', 'BYE']);
        }
        return {
            bracketSize: mainDrawSize,
            slots: paired.flat(),
            playInMatchCount: 0,
            byeRecipients: [],
        };
    }

    const byeIdx = new Set(pickByeRecipientSeedIndices(n, byeCount, priority));
    const byeRecipients: T[] = [];
    const playIn: T[] = [];
    seedsStrongestFirst.forEach((p, i) => {
        (byeIdx.has(i) ? byeRecipients : playIn).push(p);
    });
    const pvp = shuffleRemainingPairings ? [...playIn].sort(() => Math.random() - 0.5) : [...playIn];

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
