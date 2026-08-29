import type {
    AppData,
    Coupon,
    Student,
    TournamentAwardBatch,
    TournamentAwardGrant,
    TournamentAwardRecord,
    TournamentAwardRequest,
    Transaction,
} from '../../types';

export const TOURNAMENT_AWARD_COUPON_DAYS = 30;

export interface TournamentAwardPreviewRow {
    studentId: string;
    studentName: string;
    description: string;
    requestedAmount: number;
    creditedAmount: number;
    overflowAmount: number;
}

export interface TournamentAwardPreview {
    rows: TournamentAwardPreviewRow[];
    recipientCount: number;
    requestedTotal: number;
    creditedTotal: number;
    overflowTotal: number;
    error?: string;
}

export interface TournamentAwardMutationResult {
    data: AppData;
    changed: boolean;
    batch?: TournamentAwardBatch;
    preview?: TournamentAwardPreview;
    error?: string;
}

interface MutationOptions {
    now?: string;
    idFactory?: () => string;
}

const defaultIdFactory = () =>
    `ta_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

const emptyPreview = (error: string): TournamentAwardPreview => ({
    rows: [],
    recipientCount: 0,
    requestedTotal: 0,
    creditedTotal: 0,
    overflowTotal: 0,
    error,
});

export function previewTournamentAward(
    students: Student[],
    grants: TournamentAwardGrant[]
): TournamentAwardPreview {
    const positive = grants.filter(grant => grant.amount > 0);
    if (positive.length === 0) return emptyPreview('지급할 양수 스톤이 없습니다.');
    if (positive.some(grant => !Number.isFinite(grant.amount))) {
        return emptyPreview('지급 스톤은 유효한 숫자여야 합니다.');
    }

    const seen = new Set<string>();
    const studentMap = new Map(students.map(student => [student.id, student]));
    const rows: TournamentAwardPreviewRow[] = [];
    for (const grant of positive) {
        if (seen.has(grant.studentId)) {
            return emptyPreview('한 시상 묶음에 같은 학생을 두 번 넣을 수 없습니다.');
        }
        seen.add(grant.studentId);
        const student = studentMap.get(grant.studentId);
        if (!student) return emptyPreview(`학생을 찾을 수 없습니다: ${grant.studentId}`);
        const current = Math.max(0, student.stones || 0);
        const capacity = Math.max(0, (student.maxStones || 0) - current);
        const creditedAmount = Math.min(grant.amount, capacity);
        rows.push({
            studentId: student.id,
            studentName: student.name,
            description: grant.description,
            requestedAmount: grant.amount,
            creditedAmount,
            overflowAmount: grant.amount - creditedAmount,
        });
    }

    return {
        rows,
        recipientCount: rows.length,
        requestedTotal: rows.reduce((sum, row) => sum + row.requestedAmount, 0),
        creditedTotal: rows.reduce((sum, row) => sum + row.creditedAmount, 0),
        overflowTotal: rows.reduce((sum, row) => sum + row.overflowAmount, 0),
    };
}

export function hasActiveTournamentAward(
    ledger: TournamentAwardBatch[] | undefined,
    eventKey: string
): boolean {
    return (ledger || []).some(
        batch => batch.eventKey === eventKey && batch.grants.some(grant => grant.status === 'active')
    );
}

export function applyTournamentAward(
    data: AppData,
    request: TournamentAwardRequest,
    options: MutationOptions = {}
): TournamentAwardMutationResult {
    if (!request.eventKey.trim()) {
        return { data, changed: false, error: '시상 이벤트 키가 없습니다.' };
    }
    if (hasActiveTournamentAward(data.tournamentAwardLedger, request.eventKey)) {
        return { data, changed: false, error: '이 대회 단계에는 이미 활성 시상 내역이 있습니다.' };
    }

    const preview = previewTournamentAward(data.students, request.grants);
    if (preview.error) return { data, changed: false, preview, error: preview.error };

    const id = options.idFactory || defaultIdFactory;
    const awardedAt = request.awardedAt || options.now || new Date().toISOString();
    const awardedTime = new Date(awardedAt).getTime();
    if (!Number.isFinite(awardedTime)) {
        return { data, changed: false, error: '시상 시각이 올바르지 않습니다.' };
    }
    const expiresAt = new Date(
        awardedTime + TOURNAMENT_AWARD_COUPON_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();
    const batchId = id();
    const students = data.students.map(student => ({ ...student }));
    const studentMap = new Map(students.map(student => [student.id, student]));
    const transactions: Transaction[] = [];
    const coupons: Coupon[] = [];
    const records: TournamentAwardRecord[] = [];

    for (const row of preview.rows) {
        const student = studentMap.get(row.studentId)!;
        const before = Math.max(0, student.stones || 0);
        student.stones = before + row.creditedAmount;
        const recordId = id();
        const transactionId = id();
        const couponId = row.overflowAmount > 0 ? id() : undefined;
        transactions.push({
            id: transactionId,
            studentId: row.studentId,
            type: 'tournament_award',
            description: row.description,
            amount: row.creditedAmount,
            timestamp: awardedAt,
            status: 'active',
            stoneBalanceBefore: before,
            stoneBalanceAfter: student.stones,
            tournamentAwardBatchId: batchId,
            tournamentAwardRecordId: recordId,
        });
        if (couponId) {
            coupons.push({
                id: couponId,
                studentId: row.studentId,
                description: `${row.description} 초과분`,
                value: row.overflowAmount,
                expiresAt,
            });
        }
        records.push({
            id: recordId,
            studentId: row.studentId,
            studentName: row.studentName,
            description: row.description,
            requestedAmount: row.requestedAmount,
            appliedAmount: row.creditedAmount,
            overflowAmount: row.overflowAmount,
            transactionId,
            couponId,
            status: 'active',
        });
    }

    const batch: TournamentAwardBatch = {
        id: batchId,
        eventKey: request.eventKey,
        mode: request.mode,
        label: request.label,
        awardedAt,
        status: 'active',
        grants: records,
        metadata: request.metadata,
    };
    return {
        data: {
            ...data,
            students,
            transactions: [...transactions.reverse(), ...(data.transactions || [])],
            coupons: [...(data.coupons || []), ...coupons],
            tournamentAwardLedger: [batch, ...(data.tournamentAwardLedger || [])],
        },
        changed: true,
        batch,
        preview,
    };
}

function reverseRecords(
    data: AppData,
    batchId: string,
    recordId: string | undefined,
    options: MutationOptions
): TournamentAwardMutationResult {
    const ledger = data.tournamentAwardLedger || [];
    const batchIndex = ledger.findIndex(batch => batch.id === batchId);
    if (batchIndex < 0) return { data, changed: false, error: '시상 묶음을 찾을 수 없습니다.' };
    const target = ledger[batchIndex];
    const activeTargets = target.grants.filter(
        grant => grant.status === 'active' && (!recordId || grant.id === recordId)
    );
    if (recordId && !target.grants.some(grant => grant.id === recordId)) {
        return { data, changed: false, error: '학생 시상 내역을 찾을 수 없습니다.' };
    }
    if (activeTargets.length === 0) return { data, changed: false, batch: target };

    const id = options.idFactory || defaultIdFactory;
    const reversedAt = options.now || new Date().toISOString();
    const targetIds = new Set(activeTargets.map(grant => grant.id));
    const students = data.students.map(student => ({ ...student }));
    const studentMap = new Map(students.map(student => [student.id, student]));
    const couponMap = new Map((data.coupons || []).map(coupon => [coupon.id, coupon]));
    const cancelledCouponIds = new Set<string>();
    const reversalTransactions: Transaction[] = [];

    const grants = target.grants.map(grant => {
        if (!targetIds.has(grant.id)) return grant;
        const student = studentMap.get(grant.studentId);
        const before = Math.max(0, student?.stones || 0);
        const actualReversedAmount = student ? Math.min(before, grant.appliedAmount) : 0;
        const after = before - actualReversedAmount;
        if (student) student.stones = after;
        const reversalTransactionId = id();
        reversalTransactions.push({
            id: reversalTransactionId,
            studentId: grant.studentId,
            type: 'tournament_award_reversal',
            description: `${grant.description} 시상 취소`,
            amount: -actualReversedAmount,
            timestamp: reversedAt,
            status: 'active',
            stoneBalanceBefore: before,
            stoneBalanceAfter: after,
            tournamentAwardBatchId: target.id,
            tournamentAwardRecordId: grant.id,
            reversesTransactionId: grant.transactionId,
        });
        const coupon = grant.couponId ? couponMap.get(grant.couponId) : undefined;
        if (coupon) cancelledCouponIds.add(coupon.id);
        return {
            ...grant,
            status: 'reversed' as const,
            reversedAt,
            actualReversedAmount,
            reversalTransactionId,
            ...(coupon && {
                couponCancellation: {
                    couponId: coupon.id,
                    cancelledAt: reversedAt,
                    value: coupon.value,
                },
            }),
        };
    });

    const activeCount = grants.filter(grant => grant.status === 'active').length;
    const updatedBatch: TournamentAwardBatch = {
        ...target,
        grants,
        status: activeCount === 0 ? 'reversed' : 'partially_reversed',
        ...(activeCount === 0 && { reversedAt }),
    };
    const nextLedger = [...ledger];
    nextLedger[batchIndex] = updatedBatch;
    return {
        data: {
            ...data,
            students,
            transactions: [...reversalTransactions.reverse(), ...(data.transactions || [])],
            coupons: (data.coupons || []).filter(coupon => !cancelledCouponIds.has(coupon.id)),
            tournamentAwardLedger: nextLedger,
        },
        changed: true,
        batch: updatedBatch,
    };
}

export function reverseTournamentAwardBatch(
    data: AppData,
    batchId: string,
    options: MutationOptions = {}
): TournamentAwardMutationResult {
    return reverseRecords(data, batchId, undefined, options);
}

export function reverseTournamentAwardGrant(
    data: AppData,
    batchId: string,
    recordId: string,
    options: MutationOptions = {}
): TournamentAwardMutationResult {
    return reverseRecords(data, batchId, recordId, options);
}
