import type { AppData, PersonalMissionTemplate } from '../types';
import { generateId } from './index';
import { personalMissionAppliesToGroup } from './missionVisibility';

export function addTemplateDismissal(prev: AppData, studentId: string, templateId: string): AppData {
    const cur = prev.personalMissionTemplateDismissals || {};
    const set = new Set(cur[studentId] || []);
    set.add(templateId);
    return { ...prev, personalMissionTemplateDismissals: { ...cur, [studentId]: [...set] } };
}

/** 해당 학생에게 템플릿에 맞는 기본 개인 미션 카드가 없으면 추가합니다. */
export function ensurePersonalMissionInstancesForStudent(prev: AppData, studentId: string): AppData {
    const student = prev.students.find(s => s.id === studentId);
    if (!student) return prev;
    const templates = prev.personalMissionTemplates || [];
    const dismiss = new Set(prev.personalMissionTemplateDismissals?.[studentId] || []);
    const list = [...(prev.personalMissions?.[studentId] || [])];
    let changed = false;
    for (const t of templates) {
        if (!personalMissionAppliesToGroup(t.targetGroups, student.group)) continue;
        if (dismiss.has(t.id)) continue;
        if (list.some(m => m.templateId === t.id)) continue;
        list.push({
            id: generateId(),
            ownerStudentId: studentId,
            templateId: t.id,
            title: t.title,
            stones: t.stones,
            no: t.no,
            missionType: t.missionType || 'continuous',
        });
        changed = true;
    }
    if (!changed) return prev;
    return {
        ...prev,
        personalMissions: {
            ...(prev.personalMissions || {}),
            [studentId]: list,
        },
    };
}

export function ensurePersonalMissionInstancesForAllStudents(prev: AppData): AppData {
    let next = prev;
    for (const s of prev.students) {
        const n = ensurePersonalMissionInstancesForStudent(next, s.id);
        if (n !== next) next = n;
    }
    return next;
}

/** 템플릿 내용 변경 시, 이미 붙어 있는 학생 카드의 제목·점수·No·유형을 맞춥니다(진행 상태는 유지). */
export function syncStudentMissionInstancesFromTemplate(prev: AppData, template: PersonalMissionTemplate): AppData {
    const nextPm = { ...(prev.personalMissions || {}) };
    for (const sid of Object.keys(nextPm)) {
        nextPm[sid] = nextPm[sid].map(m =>
            m.templateId === template.id
                ? {
                    ...m,
                    title: template.title,
                    stones: template.stones,
                    no: template.no,
                    missionType: template.missionType || 'continuous',
                }
                : m
        );
    }
    return { ...prev, personalMissions: nextPm };
}

export function deleteTemplateAndInstances(prev: AppData, templateId: string): AppData {
    const templates = (prev.personalMissionTemplates || []).filter(t => t.id !== templateId);
    const nextPm: AppData['personalMissions'] = { ...(prev.personalMissions || {}) };
    for (const sid of Object.keys(nextPm)) {
        nextPm[sid] = (nextPm[sid] || []).filter(m => m.templateId !== templateId);
    }
    const nextDismiss: NonNullable<AppData['personalMissionTemplateDismissals']> = { ...(prev.personalMissionTemplateDismissals || {}) };
    for (const sid of Object.keys(nextDismiss)) {
        nextDismiss[sid] = nextDismiss[sid].filter(id => id !== templateId);
        if (nextDismiss[sid].length === 0) delete nextDismiss[sid];
    }
    return {
        ...prev,
        personalMissionTemplates: templates,
        personalMissions: nextPm,
        personalMissionTemplateDismissals: Object.keys(nextDismiss).length ? nextDismiss : undefined,
    };
}
