import React, { useState } from 'react';
import type { TournamentAwardBatch } from '../../types';

interface TournamentAwardHistoryProps {
    batches: TournamentAwardBatch[];
    onReverseBatch: (batchId: string) => boolean;
    onReverseGrant: (batchId: string, recordId: string) => boolean;
}

const statusLabel = {
    active: '활성',
    partially_reversed: '일부 취소',
    reversed: '전체 취소',
} as const;

export const TournamentAwardHistory = ({
    batches,
    onReverseBatch,
    onReverseGrant,
}: TournamentAwardHistoryProps) => {
    const [open, setOpen] = useState(false);

    const reverseBatch = (batch: TournamentAwardBatch) => {
        const activeCount = batch.grants.filter(grant => grant.status === 'active').length;
        if (!window.confirm(
            `${batch.label} 시상 ${activeCount}건을 모두 취소할까요?\n` +
            '현재 스톤이 부족하면 0까지만 회수되며, 사용하지 않은 초과 쿠폰은 취소됩니다.'
        )) return;
        onReverseBatch(batch.id);
    };

    const reverseGrant = (batch: TournamentAwardBatch, recordId: string, studentName: string) => {
        if (!window.confirm(
            `${studentName} 학생의 ${batch.label} 시상을 취소할까요?\n` +
            '이 작업은 원장과 취소 거래에 기록됩니다.'
        )) return;
        onReverseGrant(batch.id, recordId);
    };

    return (
        <section className="tournament-award-history" style={{ marginTop: '1.5rem' }}>
            <button type="button" className="btn" onClick={() => setOpen(value => !value)}>
                시상 내역 관리 ({batches.length}) {open ? '접기' : '보기'}
            </button>
            {open && (
                <div style={{ display: 'grid', gap: '0.75rem', marginTop: '0.75rem' }}>
                    {batches.length === 0 && <p>아직 원장에 기록된 시상이 없습니다.</p>}
                    {batches.map(batch => {
                        const hasActive = batch.grants.some(grant => grant.status === 'active');
                        return (
                            <article key={batch.id} style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.9rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                                    <div>
                                        <strong>{batch.label}</strong>
                                        <span style={{ marginLeft: '0.5rem' }}>· {statusLabel[batch.status]}</span>
                                        <div style={{ fontSize: '0.85rem', opacity: 0.75 }}>
                                            {new Date(batch.awardedAt).toLocaleString('ko-KR')}
                                        </div>
                                    </div>
                                    {hasActive && (
                                        <button type="button" className="btn danger" onClick={() => reverseBatch(batch)}>
                                            남은 시상 전체 취소
                                        </button>
                                    )}
                                </div>
                                <div style={{ overflowX: 'auto', marginTop: '0.75rem' }}>
                                    <table className="swiss-standings-table">
                                        <thead>
                                            <tr><th>학생</th><th>요청</th><th>지급</th><th>쿠폰</th><th>상태</th><th>관리</th></tr>
                                        </thead>
                                        <tbody>
                                            {batch.grants.map(grant => (
                                                <tr key={grant.id}>
                                                    <td>{grant.studentName}</td>
                                                    <td>{grant.requestedAmount}</td>
                                                    <td>
                                                        {grant.appliedAmount}
                                                        {grant.status === 'reversed' && ` (회수 ${grant.actualReversedAmount ?? 0})`}
                                                    </td>
                                                    <td>
                                                        {grant.overflowAmount}
                                                        {grant.couponCancellation && ' (취소됨)'}
                                                    </td>
                                                    <td>{grant.status === 'active' ? '활성' : '취소됨'}</td>
                                                    <td>
                                                        {grant.status === 'active' && (
                                                            <button
                                                                type="button"
                                                                className="btn-sm danger"
                                                                onClick={() => reverseGrant(batch, grant.id, grant.studentName)}
                                                            >
                                                                개인 취소
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </section>
    );
};
