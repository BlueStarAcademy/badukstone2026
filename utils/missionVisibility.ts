/** 개인/특별 미션 공통: 모든 반에 노출 */
export const MISSION_ALL_GROUPS = '__all__' as const;

export function personalMissionAppliesToGroup(targetGroups: string[] | undefined, studentGroup: string): boolean {
    if (!targetGroups || targetGroups.length === 0) return true;
    if (targetGroups.includes(MISSION_ALL_GROUPS)) return true;
    return targetGroups.includes(studentGroup);
}

/** 저장소(불러오기) 유니크 키용 */
export function targetGroupsKey(targetGroups?: string[]): string {
    if (!targetGroups || targetGroups.length === 0) return '_all';
    if (targetGroups.includes(MISSION_ALL_GROUPS)) return '_all';
    return [...new Set(targetGroups)].sort().join('|');
}
