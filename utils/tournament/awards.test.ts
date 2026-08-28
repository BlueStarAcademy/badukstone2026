import { describe, expect, it } from 'vitest';
import type { AppData, Student, TournamentAwardRequest } from '../../types';
import {
    applyTournamentAward,
    reverseTournamentAwardBatch,
    reverseTournamentAwardGrant,
} from './awards';

const student = (id: string, stones: number, maxStones = 100): Student => ({
    id,
    name: `학생 ${id}`,
    rank: '10급',
    group: '중급',
    stones,
    maxStones,
    status: '재원',
    birthday: '',
    takesChess: false,
});

const appData = (students: Student[]): AppData => ({
    students,
    transactions: [],
    coupons: [],
    tournamentAwardLedger: [],
} as unknown as AppData);

const request = (grants: TournamentAwardRequest['grants']): TournamentAwardRequest => ({
    eventKey: 'bracket:session-1:final',
    mode: 'bracket',
    label: '토너먼트 결과',
    grants,
    awardedAt: '2026-08-01T00:00:00.000Z',
});

const ids = () => {
    let next = 0;
    return () => `id-${++next}`;
};

describe('tournament award ledger', () => {
    it('caps stones and creates an overflow coupon expiring exactly 30 days later', () => {
        const result = applyTournamentAward(
            appData([student('a', 90)]),
            request([{ studentId: 'a', amount: 25, description: '우승' }]),
            { idFactory: ids() }
        );

        expect(result.changed).toBe(true);
        expect(result.data.students[0].stones).toBe(100);
        expect(result.data.transactions[0].amount).toBe(10);
        expect(result.data.coupons[0]).toMatchObject({ studentId: 'a', value: 15 });
        expect(result.data.coupons[0].expiresAt).toBe('2026-08-31T00:00:00.000Z');
        expect(result.batch?.grants[0]).toMatchObject({ appliedAmount: 10, overflowAmount: 15 });
    });

    it('rejects a duplicate active event key without changing any state', () => {
        const first = applyTournamentAward(
            appData([student('a', 0)]),
            request([{ studentId: 'a', amount: 10, description: '우승' }]),
            { idFactory: ids() }
        );
        const duplicate = applyTournamentAward(
            first.data,
            request([{ studentId: 'a', amount: 20, description: '재지급' }]),
            { idFactory: ids() }
        );

        expect(duplicate.changed).toBe(false);
        expect(duplicate.data).toBe(first.data);
        expect(duplicate.error).toContain('이미');
    });

    it('reverses a whole batch, floors balances, cancels coupons, and keeps audit transactions', () => {
        const applied = applyTournamentAward(
            appData([student('a', 95), student('b', 20)]),
            request([
                { studentId: 'a', amount: 20, description: '우승' },
                { studentId: 'b', amount: 30, description: '준우승' },
            ]),
            { idFactory: ids() }
        );
        applied.data.students[1].stones = 5;
        const reversed = reverseTournamentAwardBatch(applied.data, applied.batch!.id, {
            now: '2026-08-02T00:00:00.000Z',
            idFactory: ids(),
        });

        expect(reversed.data.students.map(s => s.stones)).toEqual([95, 0]);
        expect(reversed.data.coupons).toHaveLength(0);
        expect(reversed.data.transactions).toHaveLength(4);
        expect(reversed.data.transactions.slice(0, 2).map(tx => tx.type)).toEqual([
            'tournament_award_reversal',
            'tournament_award_reversal',
        ]);
        expect(reversed.batch?.status).toBe('reversed');
        expect(reversed.batch?.grants[0].couponCancellation?.value).toBe(15);
        expect(reversed.batch?.grants[1].actualReversedAmount).toBe(5);
    });

    it('reverses one student while leaving the rest of the batch active', () => {
        const applied = applyTournamentAward(
            appData([student('a', 0), student('b', 0)]),
            request([
                { studentId: 'a', amount: 10, description: '1위' },
                { studentId: 'b', amount: 5, description: '2위' },
            ]),
            { idFactory: ids() }
        );
        const firstRecord = applied.batch!.grants[0];
        const reversed = reverseTournamentAwardGrant(applied.data, applied.batch!.id, firstRecord.id, {
            idFactory: ids(),
        });

        expect(reversed.data.students.map(s => s.stones)).toEqual([0, 5]);
        expect(reversed.batch?.status).toBe('partially_reversed');
        expect(reversed.batch?.grants.map(grant => grant.status)).toEqual(['reversed', 'active']);
    });

    it('is idempotent when reversing an already reversed grant or batch', () => {
        const applied = applyTournamentAward(
            appData([student('a', 0)]),
            request([{ studentId: 'a', amount: 10, description: '우승' }]),
            { idFactory: ids() }
        );
        const once = reverseTournamentAwardBatch(applied.data, applied.batch!.id, { idFactory: ids() });
        const twice = reverseTournamentAwardBatch(once.data, applied.batch!.id, { idFactory: ids() });
        const grantAgain = reverseTournamentAwardGrant(
            once.data,
            applied.batch!.id,
            applied.batch!.grants[0].id,
            { idFactory: ids() }
        );

        expect(twice.changed).toBe(false);
        expect(twice.data).toBe(once.data);
        expect(grantAgain.changed).toBe(false);
        expect(grantAgain.data).toBe(once.data);
    });
});
