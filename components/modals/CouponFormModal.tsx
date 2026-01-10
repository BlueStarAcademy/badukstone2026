import React, { useState } from 'react';

interface CouponFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (couponData: { description: string; value: number; expiresAt: string; }) => void;
    studentName: string;
}

export const CouponFormModal = ({ isOpen, onClose, onSave, studentName }: CouponFormModalProps) => {
    
    const getDefaultExpiryDate = () => {
        const date = new Date();
        date.setDate(date.getDate() + 30); // Default to 30 days from now
        return date.toISOString().split('T')[0];
    };

    const [description, setDescription] = useState('');
    const [value, setValue] = useState(100);
    const [expiresAt, setExpiresAt] = useState(getDefaultExpiryDate());


    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!description.trim() || value <= 0) {
            alert('유효한 쿠폰 내용과 스톤을 입력해주세요.');
            return;
        }
        // Set expiry to the end of the selected day
        const expiryDateTime = new Date(expiresAt);
        expiryDateTime.setHours(23, 59, 59, 999);
        
        onSave({ description, value, expiresAt: expiryDateTime.toISOString() });
        // Reset form for next use
        setDescription('');
        setValue(100);
        setExpiresAt(getDefaultExpiryDate());
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h2>{studentName} 학생에게 쿠폰 발급</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="description">쿠폰 내용</label>
                        <input
                            type="text"
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="예: 칭찬 쿠폰"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="value">스톤 가치</label>
                        <input
                            type="number"
                            id="value"
                            value={value}
                            onChange={(e) => setValue(parseInt(e.target.value, 10) || 0)}
                            min="1"
                            required
                            placeholder="100"
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="expiresAt">사용 기한</label>
                        <input
                            type="date"
                            id="expiresAt"
                            value={expiresAt}
                            onChange={(e) => setExpiresAt(e.target.value)}
                            min={new Date().toISOString().split('T')[0]} // Cannot select past dates
                            required
                        />
                    </div>
                    <div className="modal-actions">
                        <button type="button" className="btn" onClick={onClose}>취소</button>
                        <button type="submit" className="btn primary">발급하기</button>
                    </div>
                </form>
            </div>
        </div>
    );
};