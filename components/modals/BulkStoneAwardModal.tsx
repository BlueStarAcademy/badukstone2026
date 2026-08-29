import React, { useState, useEffect } from 'react';
import { ModalShell } from '../ui/ModalShell';

interface BulkStoneAwardModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAward: (details: { amount: number; description: string }) => void;
}

export const BulkStoneAwardModal = ({ isOpen, onClose, onAward }: BulkStoneAwardModalProps) => {
    const [amount, setAmount] = useState(0);
    const [description, setDescription] = useState('');

    useEffect(() => {
        if (isOpen) {
            setAmount(0);
            setDescription('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!description.trim()) {
            alert('사유를 입력해주세요.');
            return;
        }
        onAward({ amount, description });
    };

    return (
        <ModalShell
            title="일괄 스톤 지급/차감"
            size="sm"
            onClose={onClose}
            footer={
                <>
                    <button type="button" className="btn" onClick={onClose}>취소</button>
                    <button type="submit" form="bulk-stone-award-form" className="btn primary">적용</button>
                </>
            }
        >
            <form id="bulk-stone-award-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="bulk-amount">스톤 개수</label>
                        <input
                            type="number"
                            id="bulk-amount"
                            name="amount"
                            value={amount}
                            onChange={(e) => setAmount(parseInt(e.target.value, 10) || 0)}
                            placeholder="양수는 지급, 음수는 차감"
                            required
                        />
                         <small>양수는 지급, 음수는 차감입니다.</small>
                    </div>
                    <div className="form-group">
                        <label htmlFor="bulk-description">사유</label>
                        <input
                            type="text"
                            id="bulk-description"
                            name="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="예: 단체 미션 완료 보상"
                            required
                        />
                    </div>
            </form>
        </ModalShell>
    );
};
