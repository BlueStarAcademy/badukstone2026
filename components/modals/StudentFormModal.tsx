import React, { useState, useEffect, useMemo } from 'react';
// FIX: Corrected import path for type definitions.
import type { Student } from '../../types';

interface StudentFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (student: Omit<Student, 'id' | 'group' | 'maxStones' | 'stones' | 'chessRating'>) => void;
    studentToEdit?: Student | null;
}

const pad = (num: number) => num.toString().padStart(2, '0');

export const StudentFormModal = ({ isOpen, onClose, onSave, studentToEdit }: StudentFormModalProps) => {
    const [formData, setFormData] = useState({
        name: '',
        rank: '입문',
        status: '재원' as '재원' | '휴원',
        takesChess: false,
    });
    const [birthMonth, setBirthMonth] = useState('01');
    const [birthDay, setBirthDay] = useState('01');

    useEffect(() => {
        if (studentToEdit) {
            setFormData({
                name: studentToEdit.name,
                rank: studentToEdit.rank,
                status: studentToEdit.status,
                takesChess: !!studentToEdit.takesChess,
            });
            if (studentToEdit.birthday) {
                const [month, day] = studentToEdit.birthday.split('-');
                setBirthMonth(month);
                setBirthDay(day);
            } else {
                setBirthMonth('01');
                setBirthDay('01');
            }
        } else {
            setFormData({ name: '', rank: '입문', status: '재원', takesChess: false });
            setBirthMonth('01');
            setBirthDay('01');
        }
    }, [studentToEdit, isOpen]);

    const daysInMonth = useMemo(() => {
        // Use a leap year (2024) to correctly calculate days for February
        return new Date(2024, parseInt(birthMonth, 10), 0).getDate();
    }, [birthMonth]);

    useEffect(() => {
        if (parseInt(birthDay, 10) > daysInMonth) {
            setBirthDay(pad(daysInMonth));
        }
    }, [birthMonth, birthDay, daysInMonth]);

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            const { checked } = e.target as HTMLInputElement;
            setFormData(prev => ({ ...prev, [name]: checked }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const studentData = {
            ...formData,
            birthday: `${birthMonth}-${birthDay}`,
        };
        onSave(studentData);
        onClose();
    };

    const rankOptions = ['입문']
        .concat(Array.from({ length: 30 }, (_, i) => `${30 - i}급`))
        .concat(Array.from({ length: 9 }, (_, i) => `${i + 1}단`));

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h2>{studentToEdit ? '학생 정보 수정' : '신규 학생 등록'}</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="name">이름</label>
                        <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} required placeholder="학생 이름" />
                    </div>
                    <div className="form-group">
                        <label htmlFor="rank">급수/단</label>
                        <select id="rank" name="rank" value={formData.rank} onChange={handleChange}>
                            {rankOptions.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>생일</label>
                        <div className="inline-group">
                             <div className="form-group">
                                <label htmlFor="birthMonth" className="sr-only">월</label>
                                <select id="birthMonth" name="birthMonth" value={birthMonth} onChange={e => setBirthMonth(e.target.value)}>
                                    {Array.from({ length: 12 }, (_, i) => (
                                        <option key={i} value={pad(i + 1)}>{i + 1}월</option>
                                    ))}
                                </select>
                            </div>
                             <div className="form-group">
                                <label htmlFor="birthDay" className="sr-only">일</label>
                                <select id="birthDay" name="birthDay" value={birthDay} onChange={e => setBirthDay(e.target.value)}>
                                     {Array.from({ length: daysInMonth }, (_, i) => (
                                        <option key={i} value={pad(i + 1)}>{i + 1}일</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                    <div className="form-group">
                        <label htmlFor="status">상태</label>
                        <select id="status" name="status" value={formData.status} onChange={handleChange}>
                            <option value="재원">재원</option>
                            <option value="휴원">휴원</option>
                        </select>
                    </div>
                     <div className="form-group-checkbox">
                        <input
                            type="checkbox"
                            id="takesChess"
                            name="takesChess"
                            checked={formData.takesChess}
                            onChange={handleChange}
                        />
                        <label htmlFor="takesChess">체스 수업 수강</label>
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