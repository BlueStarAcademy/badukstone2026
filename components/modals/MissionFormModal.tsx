import React, { useState, useEffect } from 'react';
// FIX: Corrected import path for type definitions.
import type { Mission, GroupSettings } from '../../types';

interface MissionFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (mission: Omit<Mission, 'id'>) => void;
    missionToEdit?: Mission | null;
    groupSettings: GroupSettings;
    groupOrder: string[];
    isChessMission?: boolean;
}

export const MissionFormModal = ({ isOpen, onClose, onSave, missionToEdit, groupSettings, groupOrder, isChessMission }: MissionFormModalProps) => {
    const [formData, setFormData] = useState<Omit<Mission, 'id'>>({
        description: '',
        stones: 5,
        group: '초급1'
    });
    const [isAttendance, setIsAttendance] = useState(false);

    useEffect(() => {
        if (missionToEdit) {
            setFormData({
                description: missionToEdit.description,
                stones: missionToEdit.stones,
                group: missionToEdit.group,
            });
            setIsAttendance(missionToEdit.type === 'attendance');
        } else {
            setFormData({ description: '', stones: 5, group: isChessMission ? undefined : groupOrder[groupOrder.length - 1] || '초급1' });
            setIsAttendance(false);
        }
    }, [missionToEdit, isOpen, groupSettings, groupOrder, isChessMission]);

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: name === 'stones' ? parseInt(value) : value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const missionData: Omit<Mission, 'id'> = { ...formData };
        if (isAttendance) {
            missionData.type = 'attendance';
        }
        if (isChessMission) {
            delete missionData.group;
        }
        onSave(missionData);
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <h2>{missionToEdit ? '미션 수정' : '새 미션 추가'}</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="description">미션 내용</label>
                        <textarea id="description" name="description" value={formData.description} onChange={handleChange} required placeholder="예: 사활 문제 10개 풀기" />
                    </div>
                    <div className="form-group">
                        <label htmlFor="stones">보상 스톤</label>
                        <input type="number" id="stones" name="stones" value={formData.stones} onChange={handleChange} min="1" required placeholder="5" />
                    </div>
                    {!isChessMission && (
                        <div className="form-group">
                            <label htmlFor="group">대상 그룹</label>
                            <select id="group" name="group" value={formData.group} onChange={handleChange}>
                                {groupOrder.filter(key => groupSettings[key]).map(key => (
                                    <option key={key} value={key}>{groupSettings[key].name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div className="form-group-checkbox">
                        <input
                            type="checkbox"
                            id="isAttendance"
                            name="isAttendance"
                            checked={isAttendance}
                            onChange={e => setIsAttendance(e.target.checked)}
                        />
                        <label htmlFor="isAttendance">출석 미션 (하루 한번 자동 시간 기록)</label>
                    </div>
                    <div className="modal-actions">
                        <button type="button" className="btn" onClick={onClose}>취소</button>
                        <button type="submit" className="btn primary">저장</button>
                    </div>
                </form>
            </div>
        </div>
    );
};