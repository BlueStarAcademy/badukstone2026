import React, { useState, useEffect } from 'react';
import { ModalShell } from '../ui/ModalShell';

interface TournamentAwardModalProps {
    isOpen: boolean;
    onClose: () => void;
    teamName: string;
    teamType: 'winner' | 'loser';
    onAward: (amount: number, reason: string) => void;
    /** 대회 설정 조별 상금에서 가져온 기본 스톤 */
    defaultStoneAmount?: number;
    defaultReason?: string;
}

export const TournamentAwardModal = ({
    isOpen,
    onClose,
    teamName,
    teamType,
    onAward,
    defaultStoneAmount = 0,
    defaultReason,
}: TournamentAwardModalProps) => {
    const [amount, setAmount] = useState(defaultStoneAmount);
    const [reason, setReason] = useState(defaultReason ?? '');

    useEffect(() => {
        if (!isOpen) return;
        setAmount(defaultStoneAmount);
        setReason(defaultReason ?? (teamType === 'winner' ? '대회 우승 보상' : '대회 참가·격려 보상'));
    }, [isOpen, defaultStoneAmount, defaultReason, teamType]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (amount === 0 || !reason.trim()) {
            alert('스톤과 사유를 모두 입력해주세요.');
            return;
        }
        onAward(amount, reason);
    };

    return (
        <ModalShell
            title={`${teamType === 'winner' ? '승리팀' : '패배팀'} (${teamName}팀) 스톤 지급`}
            size="sm"
            onClose={onClose}
            footer={
                <>
                    <button type="button" className="btn" onClick={onClose}>취소</button>
                    <button type="submit" form="tournament-award-form" className="btn primary">지급하기</button>
                </>
            }
        >
            <form id="tournament-award-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="award-amount">지급할 스톤</label>
                        <input
                            type="number"
                            id="award-amount"
                            value={amount}
                            onChange={e => setAmount(Number(e.target.value))}
                            autoFocus
                            placeholder="0"
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="award-reason">사유</label>
                        <input
                            type="text"
                            id="award-reason"
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            placeholder={teamType === 'winner' ? '예: 대회 우승 보상' : '예: 대회 참가상'}
                        />
                    </div>
            </form>
        </ModalShell>
    );
};