
import React, { useState, useMemo, useEffect } from 'react';
import type { Student } from '../../types';
import { parseRank } from '../../utils';

interface TournamentPlayerManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
    allStudents: Student[];
    participantIds: string[];
    onUpdateParticipants: (ids: string[]) => void;
    onAssignTeams: (mode: 'random' | 'ranked', ids?: string[]) => void;
    currentView: 'relay' | 'bracket' | 'swiss' | 'hybrid' | 'mission';
    onStartSwiss: (mode: 'random' | 'ranked', ids: string[]) => void; // IDs 매개변수 추가
    onInitMission?: (ids?: string[]) => void;
    onInitHybrid?: (ids: string[]) => void; // 하이브리드 초기화 추가
}

export const TournamentPlayerManagementModal = (props: TournamentPlayerManagementModalProps) => {
    const { 
        isOpen, onClose, allStudents, participantIds, 
        onUpdateParticipants, onAssignTeams, currentView, onStartSwiss, onInitMission, onInitHybrid
    } = props;

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [assignmentMode, setAssignmentMode] = useState<'random' | 'ranked'>('ranked');

    useEffect(() => {
        if (isOpen) {
            setSelectedIds(new Set(participantIds));
            setSearchTerm('');
            setAssignmentMode('ranked');
        }
    }, [isOpen, participantIds]);

    const availableStudents = useMemo(() => {
        return allStudents
            .filter(s => s.status === '재원')
            .filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
            .sort((a, b) => parseRank(b.rank) - parseRank(a.rank));
    }, [allStudents, searchTerm]);
    
    const selectedStudentsList = useMemo(() => {
        return allStudents
            .filter(s => selectedIds.has(s.id))
            .sort((a, b) => parseRank(b.rank) - parseRank(a.rank));
    }, [allStudents, selectedIds]);

    if (!isOpen) return null;

    const handleToggleStudent = (studentId: string) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(studentId)) {
                newSet.delete(studentId);
            } else {
                newSet.add(studentId);
            }
            return newSet;
        });
    };

    const handleSelectAll = () => {
        setSelectedIds(new Set(availableStudents.map(s => s.id)));
    };
    
    const handleDeselectAll = () => {
        setSelectedIds(new Set());
    };

    const handleSaveAndClose = () => {
        onUpdateParticipants(Array.from(selectedIds) as string[]);
        onClose();
    };

    const handleFinalize = () => {
        const ids = Array.from(selectedIds) as string[];
        onUpdateParticipants(ids);
        
        if (currentView === 'relay') {
            onAssignTeams(assignmentMode, ids);
        } else if (currentView === 'swiss') {
            onStartSwiss(assignmentMode, ids); // 수정: ids 전달
        } else if (currentView === 'mission' && onInitMission) {
            onInitMission(ids);
        } else if (currentView === 'hybrid' && onInitHybrid) {
            onInitHybrid(ids); // 추가: 하이브리드 초기화
        }
    };

    const isUnchanged = useMemo(() => {
        if (selectedIds.size !== participantIds.length) return false;
        return participantIds.every(id => selectedIds.has(id));
    }, [selectedIds, participantIds]);

    const showFinalizeButton = currentView === 'relay' || currentView === 'swiss' || currentView === 'mission' || currentView === 'hybrid';
    const showAssignmentOptions = currentView === 'relay' || currentView === 'swiss';

    let finalizeButtonText = '시작';
    if (currentView === 'relay') finalizeButtonText = '배정';
    else if (currentView === 'swiss') finalizeButtonText = '스위스 리그 시작';
    else if (currentView === 'mission') finalizeButtonText = '미션 바둑 시작';
    else if (currentView === 'hybrid') finalizeButtonText = '예선 리그 생성';

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{maxWidth: '900px'}}>
                <h2>대회 선수 관리</h2>
                <div className="modal-body">
                    <div className="form-group">
                        <input
                            type="text"
                            placeholder="이름으로 선수 검색..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>
                    
                    <div className="player-mgmt-container">
                        <div className="player-mgmt-col">
                            <div className="player-mgmt-header">
                                전체 학생 ({availableStudents.length}명)
                                <div style={{marginTop: '5px'}}>
                                    <button className="btn-sm" onClick={handleSelectAll} style={{marginRight: '5px'}}>전체 선택</button>
                                </div>
                            </div>
                            <ul className="player-mgmt-list">
                                {availableStudents.map(student => (
                                    <li
                                        key={student.id}
                                        className={`player-mgmt-item ${selectedIds.has(student.id) ? 'selected' : ''}`}
                                        onClick={() => handleToggleStudent(student.id)}
                                    >
                                        <span>{student.name} <small>({student.rank})</small></span>
                                        {selectedIds.has(student.id) && <span>✔️</span>}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        
                        <div className="player-mgmt-col">
                            <div className="player-mgmt-header">
                                참가 예정 선수 ({selectedIds.size}명)
                                <div style={{marginTop: '5px'}}>
                                    <button className="btn-sm" onClick={handleDeselectAll}>전체 해제</button>
                                </div>
                            </div>
                            <ul className="player-mgmt-list">
                                {selectedStudentsList.map(student => (
                                    <li key={student.id} className="player-mgmt-item" onClick={() => handleToggleStudent(student.id)}>
                                        <span>{student.name}</span>
                                        <small>({student.rank})</small>
                                    </li>
                                ))}
                                {selectedStudentsList.length === 0 && (
                                    <li style={{padding: '1rem', color: '#999', textAlign: 'center'}}>선택된 선수가 없습니다.</li>
                                )}
                            </ul>
                        </div>
                    </div>
                </div>
                <div className="modal-actions">
                    <button type="button" className="btn" onClick={onClose}>취소</button>
                    <button type="button" className="btn" onClick={handleSaveAndClose} disabled={isUnchanged}>
                        참가자 목록 저장
                    </button>
                    {showFinalizeButton && (
                        <>
                        {showAssignmentOptions && (
                            <div className="form-group inline-group" style={{alignItems: 'center', marginRight: 'auto', marginLeft: '1rem'}}>
                                <label htmlFor="assignment-mode">배정/시드 방식:</label>
                                <select id="assignment-mode" value={assignmentMode} onChange={e => setAssignmentMode(e.target.value as 'random' | 'ranked')}>
                                    <option value="ranked">급수 순</option>
                                    <option value="random">무작위</option>
                                </select>
                            </div>
                        )}
                        <button type="button" className="btn primary" onClick={handleFinalize}>
                            {finalizeButtonText} ({selectedIds.size}명)
                        </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
