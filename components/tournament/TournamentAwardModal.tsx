import React, { useState } from 'react';

interface TournamentAwardModalProps {
    isOpen: boolean;
    onClose: () => void;
    teamName: string;
    teamType: 'winner' | 'loser';
    onAward: (amount: number, reason: string) => void;
}

export const TournamentAwardModal = ({ isOpen, onClose, teamName, teamType, onAward }: TournamentAwardModalProps) => {
    const [amount, setAmount] = useState(0);
    const [reason, setReason] = useState('');

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
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h2>{teamType === 'winner' ? '승리팀' : '패배팀'} ({teamName}팀) 스톤 지급</h2>
                <form onSubmit={handleSubmit}>
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
                    <div className="modal-actions">
                        <button type="button" className="btn" onClick={onClose}>취소</button>
                        <button type="submit" className="btn primary">지급하기</button>
                    </div>
                </form>
            </div>
        </div>
    );
};