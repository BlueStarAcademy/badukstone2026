import { describe, expect, it, vi, afterEach } from 'vitest';
import type { SpecialMission } from '../types';
import { MISSION_ALL_GROUPS } from './missionVisibility';
import {
    hasStarGroupConfig,
    isStarExposedToGroup,
    pickSpecialMissionForStudent,
    specialMissionVisibleToStudent,
} from './specialMissionPick';

const groupOrder = ['입문', '초급', '중급'];

function mission(partial: Partial<SpecialMission> & Pick<SpecialMission, 'id' | 'stars'>): SpecialMission {
    return {
        content: partial.content || partial.id,
        stones: 10,
        ...partial,
    };
}

describe('isStarExposedToGroup', () => {
    it('설정이 없으면 모두 노출', () => {
        expect(isStarExposedToGroup(5, '입문', null)).toBe(true);
        expect(isStarExposedToGroup(5, '입문', undefined)).toBe(true);
    });

    it('공동이면 모든 반 노출', () => {
        expect(isStarExposedToGroup(5, '중급', { 5: [MISSION_ALL_GROUPS] })).toBe(true);
    });

    it('선택된 반만 노출', () => {
        expect(isStarExposedToGroup(3, '초급', { 3: ['입문', '초급'] })).toBe(true);
        expect(isStarExposedToGroup(3, '중급', { 3: ['입문', '초급'] })).toBe(false);
    });

    it('빈 배열이면 비노출', () => {
        expect(isStarExposedToGroup(2, '입문', { 2: [] })).toBe(false);
    });

    it('해당 별 키가 없으면 전체 허용', () => {
        expect(isStarExposedToGroup(1, '입문', { 5: ['중급'] })).toBe(true);
    });
});

describe('hasStarGroupConfig', () => {
    it('키가 하나라도 있으면 true', () => {
        expect(hasStarGroupConfig({ 5: ['입문'] })).toBe(true);
        expect(hasStarGroupConfig({})).toBe(false);
        expect(hasStarGroupConfig(null)).toBe(false);
    });
});

describe('pickSpecialMissionForStudent', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('별→반 설정이 있으면 해당 별만 후보에 넣는다', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0); // ★5 항상 선택
        const missions = [
            mission({ id: 'a', stars: 5, content: 'hard' }),
            mission({ id: 'b', stars: 1, content: 'easy' }),
        ];
        const picked = pickSpecialMissionForStudent(
            missions,
            '입문',
            groupOrder,
            { 1: 100, 2: 0, 3: 0, 4: 0, 5: 100 },
            { 5: ['중급'], 1: ['입문'] }
        );
        expect(picked?.id).toBe('b');
    });

    it('별→반 설정이 없으면 레거시 visibleGroups를 쓴다', () => {
        const missions = [
            mission({ id: 'a', stars: 3, visibleGroups: ['중급'] }),
            mission({ id: 'b', stars: 3, visibleGroups: ['입문'] }),
        ];
        vi.spyOn(Math, 'random').mockReturnValue(0);
        const picked = pickSpecialMissionForStudent(
            missions,
            '입문',
            groupOrder,
            { 1: 0, 2: 0, 3: 100, 4: 0, 5: 0 },
            null
        );
        expect(picked?.id).toBe('b');
    });
});

describe('specialMissionVisibleToStudent', () => {
    it('visibleGroups 공동이면 true', () => {
        expect(specialMissionVisibleToStudent(
            mission({ id: 'x', stars: 1, visibleGroups: [MISSION_ALL_GROUPS] }),
            '초급',
            groupOrder
        )).toBe(true);
    });
});
