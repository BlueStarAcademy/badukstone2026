import type { TournamentByePriority } from '../types';

export const DEFAULT_BYE_PRIORITY: TournamentByePriority = 'min_byes';

export function minimalPow2BracketSize(n: number): number {
    return Math.pow(2, Math.ceil(Math.log2(Math.max(2, n))));
}

/**
 * 단판/예선 본선 등: 시드 순서에서 부전승을 받을 B명의 인덱스(0 = 최강).
 * - min_byes: 2의 거듭제곱 껍데기에서 부전승 "개수"는 이미 최소. 받는 사람을 순위 전체에 고르게 퍼뜨림.
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
 * 토너먼트 1라운드 슬롯 (player, player | BYE, …) 길이 = bracketSize.
 * 앞쪽부터 numByes 경기는 (부전승 받는 선수, BYE) 순서로 채움.
 */
export function buildElimRoundOneSlotOrder<T>(
    seedsStrongestFirst: T[],
    priority: TournamentByePriority,
    shuffleRemainingPairings: boolean
): { bracketSize: number; slots: (T | 'BYE')[] } {
    const n = seedsStrongestFirst.length;
    const bracketSize = minimalPow2BracketSize(n);
    const B = bracketSize - n;
    const byeIdx = new Set(pickByeRecipientSeedIndices(n, B, priority));
    const byeRecipients: T[] = [];
    const playIn: T[] = [];
    seedsStrongestFirst.forEach((p, i) => {
        (byeIdx.has(i) ? byeRecipients : playIn).push(p);
    });
    const pvp = shuffleRemainingPairings ? [...playIn].sort(() => Math.random() - 0.5) : [...playIn];
    const slots: (T | 'BYE')[] = [];
    let bi = 0;
    let pi = 0;
    for (let m = 0; m < bracketSize / 2; m++) {
        if (bi < byeRecipients.length) {
            slots.push(byeRecipients[bi++], 'BYE');
        } else {
            slots.push(pvp[pi++], pvp[pi++]);
        }
    }
    return { bracketSize, slots };
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
