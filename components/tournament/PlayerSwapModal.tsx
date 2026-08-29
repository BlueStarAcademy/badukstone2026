import React, { useState, useEffect } from 'react';
import type { Student, TournamentPlayer } from '../../types';
import { ModalShell } from '../ui/ModalShell';

interface PlayerSwapModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSwap: (newStudent: Student) => void;
    playerToReplace?: TournamentPlayer | null;
    availableStudents: Student[];
}

export const PlayerSwapModal = ({ isOpen, onClose, onSwap, playerToReplace, availableStudents }: PlayerSwapModalProps) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setSearchTerm('');
            setSelectedStudentId(null);
        }
    }, [isOpen]);

    if (!isOpen || !playerToReplace) return null;

    const filteredStudents = availableStudents.filter(s => 
        s.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleConfirmSwap = () => {
        const student = availableStudents.find(s => s.id === selectedStudentId);
        if (student) {
            onSwap(student);
        } else {
            alert('교체할 학생을 선택해주세요.');
        }
    };

    return (
        <ModalShell
            title={`${playerToReplace.name} 선수 교체`}
            size="sm"
            onClose={onClose}
            footer={
                <>
                    <button type="button" className="btn" onClick={onClose}>취소</button>
                    <button type="button" className="btn primary" onClick={handleConfirmSwap} disabled={!selectedStudentId}>
                        선수 교체
                    </button>
                </>
            }
        >
                    <div className="form-group">
                        <label htmlFor="swap-search">교체할 학생 검색</label>
                        <input
                            type="text"
                            id="swap-search"
                            placeholder="이름으로 검색..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <ul className="available-student-list">
                        {filteredStudents.length === 0 ? (
                            <li className="available-student-empty">검색 결과가 없습니다.</li>
                        ) : (
                            filteredStudents.map(student => (
                                <li 
                                    key={student.id} 
                                    className={`available-student-item ${selectedStudentId === student.id ? 'selected' : ''}`} 
                                    onClick={() => setSelectedStudentId(student.id)}
                                >
                                    <span>{student.name} <small>({student.rank})</small></span>
                                    {selectedStudentId === student.id && <span className="check-icon">✓</span>}
                                </li>
                            ))
                        )}
                    </ul>
        </ModalShell>
    );
};