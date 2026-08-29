import { describe, expect, it } from 'vitest';
import type { AppData, PersonalMissionTemplate, Student } from '../types';
import {
    ensurePersonalMissionInstancesForAllStudents,
    ensurePersonalMissionInstancesForStudent,
    syncStudentMissionInstancesFromTemplate,
} from './personalMissionTemplateSync';

const student = (id: string, group = 'beginner'): Student => ({
    id,
    name: `학생 ${id}`,
    rank: '10급',
    group,
    stones: 0,
    maxStones: 100,
    status: '재원',
    birthday: '',
});

const template = (overrides: Partial<PersonalMissionTemplate> = {}): PersonalMissionTemplate => ({
    id: 'template-1',
    title: '정석 외우기',
    stones: 10,
    no: 1,
    missionType: 'continuous',
    targetGroups: ['__all__'],
    ...overrides,
});

const appData = (students: Student[], missionTemplate = template()): AppData => ({
    students,
    personalMissionTemplates: [missionTemplate],
    personalMissions: {},
} as unknown as AppData);

describe('personal mission template sync', () => {
    it('uses the template number when creating a mission for a new student', () => {
        const data = appData([student('a')], template({ no: 4 }));

        const next = ensurePersonalMissionInstancesForStudent(data, 'a');

        expect(next.personalMissions?.a).toHaveLength(1);
        expect(next.personalMissions?.a[0]).toMatchObject({
            ownerStudentId: 'a',
            templateId: 'template-1',
            title: '정석 외우기',
            no: 4,
        });
    });

    it('preserves each student current number when the common template changes', () => {
        const data = appData([student('a'), student('b')]);
        data.personalMissions = {
            a: [{
                id: 'mission-a',
                ownerStudentId: 'a',
                templateId: 'template-1',
                title: '이전 제목',
                stones: 5,
                no: 8,
                missionType: 'continuous',
            }],
            b: [{
                id: 'mission-b',
                ownerStudentId: 'b',
                templateId: 'template-1',
                title: '이전 제목',
                stones: 5,
                no: 3,
                missionType: 'continuous',
            }],
        };

        const next = syncStudentMissionInstancesFromTemplate(
            data,
            template({ title: '새 정석', stones: 20, no: 99 })
        );

        expect(next.personalMissions?.a[0].no).toBe(8);
        expect(next.personalMissions?.b[0].no).toBe(3);
    });

    it('propagates common title, score, and type while preserving completion state', () => {
        const data = appData([student('a')]);
        data.personalMissions = {
            a: [{
                id: 'mission-a',
                ownerStudentId: 'a',
                templateId: 'template-1',
                title: '이전 제목',
                stones: 5,
                no: 7,
                missionType: 'continuous',
                completedAt: '2026-08-01T00:00:00.000Z',
            }],
        };

        const next = syncStudentMissionInstancesFromTemplate(
            data,
            template({ title: '이번 주 복습', stones: 15, missionType: 'weekly', no: 0 })
        );

        expect(next.personalMissions?.a[0]).toMatchObject({
            title: '이번 주 복습',
            stones: 15,
            missionType: 'weekly',
            no: 7,
            completedAt: '2026-08-01T00:00:00.000Z',
        });
    });

    it('creates missing instances for every eligible student without duplicating existing ones', () => {
        const data = appData([student('a'), student('b')]);
        data.personalMissions = {
            a: [{
                id: 'mission-a',
                ownerStudentId: 'a',
                templateId: 'template-1',
                title: '정석 외우기',
                stones: 10,
                no: 6,
                missionType: 'continuous',
            }],
        };

        const next = ensurePersonalMissionInstancesForAllStudents(data);

        expect(next.personalMissions?.a).toHaveLength(1);
        expect(next.personalMissions?.a[0].no).toBe(6);
        expect(next.personalMissions?.b).toHaveLength(1);
        expect(next.personalMissions?.b[0].no).toBe(1);
    });
});
