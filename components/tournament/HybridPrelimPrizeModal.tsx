import React, { useState, useEffect } from 'react';
import type { TournamentSettings, SwissMatch, SwissPlayer, TournamentSwissGroupPrizes } from '../../types';
import {
    computeStandingsInPreliminaryGroup,
    getHybridPrelimPrizeRow,
    getSwissPaidRankCount,
} from '../../utils/tournamentPrizes';
import { SwissRankPrizeFields } from '../modals/TournamentGroupPrizeEditors';

interface HybridPrelimPrizeModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: TournamentSettings;
    groupIndex: number;
    groupLabel: string;
    groupMatches: SwissMatch[];
    allPlayers: SwissPlayer[];
    onAward: (prizes: TournamentSwissGroupPrizes) => void;
}

export const HybridPrelimPrizeModal = ({
    isOpen,
    onClose,
    settings,
    groupIndex,
    groupLabel,
    groupMatches,
    allPlayers,
    onAward,
}: HybridPrelimPrizeModalProps) => {
    const [prizes, setPrizes] = useState<TournamentSwissGroupPrizes>(getHybridPrelimPrizeRow(settings, groupIndex));

    useEffect(() => {
        if (!isOpen) return;
        setPrizes(getHybridPrelimPrizeRow(settings, groupIndex));
    }, [isOpen, settings, groupIndex]);

    if (!isOpen) return null;

    const ranks = computeStandingsInPreliminaryGroup(groupMatches, allPlayers);

    const paidCount = getSwissPaidRankCount(settings);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onAward(prizes);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '720px' }}>
                <h2>예선 시상 — {groupLabel}</h2>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <div>
                            <h4>순위 (이 조 경기만 반영)</h4>
                            <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                                <table className="swiss-standings-table">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>이름</th>
                                            <th>승점</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {ranks.map((p, i) => (
                                            <tr key={p.studentId}>
                                                <td>{i + 1}</td>
                                                <td>{p.name}</td>
                                                <td>{p.score}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="settings-form-section" style={{ marginTop: 0 }}>
                            <h4>보상 (스톤)</h4>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-color-secondary)' }}>
                                대회 설정의 「예선+본선 → 예선 조별 상금」에서 기본값을 바꿀 수 있습니다.
                            </p>
                            <SwissRankPrizeFields paidCount={paidCount} prizes={prizes} onChange={setPrizes} />
                        </div>
                    </div>
                    <div className="modal-actions">
                        <button type="button" className="btn" onClick={onClose}>
                            취소
                        </button>
                        <button type="submit" className="btn primary">
                            스톤 지급
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
