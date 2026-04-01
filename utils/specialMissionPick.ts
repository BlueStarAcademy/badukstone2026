import type { SpecialMission } from '../types';
import { MISSION_ALL_GROUPS } from './missionVisibility';

/** 레거시: isExclusive / isAtLeast 만 적용 (기존 데이터 호환) */
export function specialMissionVisibleToStudent(m: SpecialMission, studentGroup: string, groupOrder: string[]): boolean {
    if (m.visibleGroups && m.visibleGroups.length > 0) {
        if (m.visibleGroups.includes(MISSION_ALL_GROUPS)) return true;
        return m.visibleGroups.includes(studentGroup);
    }

    const studentIdx = groupOrder.indexOf(studentGroup);
    const missionGroupIdx = groupOrder.indexOf(m.group || '');
    if (missionGroupIdx === -1 || studentIdx === -1) return true;
    if (m.isExclusive && studentIdx < missionGroupIdx) return false;
    if (m.isAtLeast && studentIdx > missionGroupIdx) return false;
    return true;
}

/**
 * ★5→★2: 각 단계에서 해당 별 미션이 있으면 설정 확률(%)로 그 단계에서 선택 시도.
 * 모두 실패 시: 후보 중 가장 낮은 별(가장 쉬운 난이도) 풀에서 무조건 1개 선택.
 */
export function pickSpecialMissionForStudent(
    missions: SpecialMission[],
    studentGroup: string,
    groupOrder: string[],
    weights: { [stars: number]: number }
): SpecialMission | null {
    const available = missions.filter(m => specialMissionVisibleToStudent(m, studentGroup, groupOrder));
    if (available.length === 0) return null;

    const w = (s: number) => Math.min(100, Math.max(0, Number(weights[s] ?? 0)));

    for (let star = 5; star >= 2; star--) {
        const pool = available.filter(m => m.stars === star);
        if (pool.length === 0) continue;
        if (Math.random() * 100 < w(star)) {
            return pool[Math.floor(Math.random() * pool.length)];
        }
    }

    const minStars = Math.min(...available.map(m => m.stars));
    const fallback = available.filter(m => m.stars === minStars);
    return fallback[Math.floor(Math.random() * fallback.length)];
}
