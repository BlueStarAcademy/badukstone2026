import React, { useState, useEffect } from 'react';
import type { TournamentSettings } from '../../types';
import type { BracketPrizeSettingsKey, TournamentBracketPrizeModalMode, BracketPrizePayout } from '../../utils/tournamentPrizes';
import {
    getBracketPrizeRow,
    bracketPrizeGroupCount,
    getBracketPaidRankCount,
    bracketPayoutFromRow,
    bracketRowFromRankAmounts,
    payoutToRankAmounts,
} from '../../utils/tournamentPrizes';
import { BracketRankPrizeFields } from '../modals/TournamentGroupPrizeEditors';
import { ModalShell } from '../ui/ModalShell';

interface TournamentPrizeModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: TournamentSettings;
    /** 토너먼트·풀리그·더블엘리는 bracket, 예선+본선 본선은 hybridBracket */
    prizeKey: BracketPrizeSettingsKey;
    /** 모달 제목 */
    mode: TournamentBracketPrizeModalMode;
    onAwardPrizes: (prizes: BracketPrizePayout) => void;
}

const modalTitle: Record<TournamentBracketPrizeModalMode, string> = {
    bracket: '토너먼트 결과 시상',
    fullleague: '풀리그 결과 시상',
    doubleelim: '더블엘리미네이션 결과 시상',
    hybridBracket: '본선 토너먼트 결과 시상',
};

export const TournamentPrizeModal = ({
    isOpen,
    onClose,
    settings,
    prizeKey,
    mode,
    onAwardPrizes,
}: TournamentPrizeModalProps) => {
    const nGroups = bracketPrizeGroupCount(settings, prizeKey);
    const paidCount = getBracketPaidRankCount(settings);
    const [prizeGroupIndex, setPrizeGroupIndex] = useState(0);
    const [prizes, setPrizes] = useState<BracketPrizePayout>(() =>
        bracketPayoutFromRow(getBracketPrizeRow(settings, prizeKey, 0), paidCount)
    );

    useEffect(() => {
        if (!isOpen) return;
        setPrizeGroupIndex(0);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const row = getBracketPrizeRow(settings, prizeKey, prizeGroupIndex);
        setPrizes(bracketPayoutFromRow(row, getBracketPaidRankCount(settings)));
    }, [settings, isOpen, prizeKey, prizeGroupIndex]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onAwardPrizes(prizes);
    };

    const asRow = bracketRowFromRankAmounts(payoutToRankAmounts(prizes, paidCount), prizes.participant);

    return (
        <ModalShell
            title={modalTitle[mode]}
            size="md"
            onClose={onClose}
            className="tournament-prize-award-modal"
            footer={
                <>
                    <button type="button" className="btn" onClick={onClose}>
                        취소
                    </button>
                    <button type="submit" form="tournament-prize-form" className="btn primary">
                        스톤 지급
                    </button>
                </>
            }
        >
                <form id="tournament-prize-form" onSubmit={handleSubmit}>
                        {nGroups > 1 && (
                            <div className="tsm-field-row" style={{ marginBottom: '1rem' }}>
                                <label htmlFor="prize-group-idx">적용 조</label>
                                <select
                                    id="prize-group-idx"
                                    value={prizeGroupIndex}
                                    onChange={e => setPrizeGroupIndex(Number(e.target.value))}
                                >
                                    {Array.from({ length: nGroups }, (_, i) => (
                                        <option key={i} value={i}>
                                            {i + 1}조 (대회 설정 기준)
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <p className="tsm-prize-hint">3·4위와 5위 이하를 분리해 지급합니다. 금액은 시상 전에 확인·수정하세요.</p>
                        <BracketRankPrizeFields
                            paidCount={paidCount}
                            prizes={asRow}
                            onChange={next => setPrizes(bracketPayoutFromRow(next, paidCount))}
                        />
                </form>
        </ModalShell>
    );
};
