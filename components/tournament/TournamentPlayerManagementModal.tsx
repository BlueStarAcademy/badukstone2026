
import React, { useState, useMemo, useEffect } from 'react';
import type { Student, TournamentSettings } from '../../types';
import { parseRank } from '../../utils';
import { parseSwissGroupSizes } from '../../utils/tournamentPrizes';
import { ModalShell } from '../ui/ModalShell';

interface TournamentPlayerManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
    allStudents: Student[];
    participantIds: string[];
    onUpdateParticipants: (ids: string[]) => void;
    onAssignTeams: (mode: 'random' | 'ranked', ids: string[]) => void;
    currentView: 'relay' | 'bracket' | 'swiss' | 'hybrid' | 'fullleague' | 'doubleelim' | 'mission';
    tournamentSettings?: TournamentSettings;
    onStartSwiss: (mode: 'random' | 'ranked', ids: string[]) => void;
    onInitMission?: (mode: 'random' | 'ranked', ids: string[]) => void;
    onInitHybrid?: (mode: 'random' | 'ranked', ids: string[]) => void;
    onInitFullLeague?: (mode: 'random' | 'ranked', ids: string[]) => void;
    onInitDoubleElim?: (mode: 'random' | 'ranked', ids: string[]) => void;
    onInitBracket?: (mode: 'random' | 'ranked', ids: string[]) => void;
}

export const TournamentPlayerManagementModal = (props: TournamentPlayerManagementModalProps) => {
    const {
        isOpen,
        onClose,
        allStudents,
        participantIds,
        onUpdateParticipants,
        onAssignTeams,
        currentView,
        tournamentSettings,
        onStartSwiss,
        onInitMission,
        onInitHybrid,
        onInitFullLeague,
        onInitDoubleElim,
        onInitBracket,
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
        
        // 중요: 각 모드별 전용 초기화 함수만 호출하도록 변경 (onUpdateParticipants 중복 호출 제거)
        // 이는 여러 번의 setData 호출로 인한 상태 덮어쓰기(Race Condition)를 방지합니다.
        if (currentView === 'relay') {
            onAssignTeams(assignmentMode, ids);
        } else if (currentView === 'swiss') {
            onStartSwiss(assignmentMode, ids);
        } else if (currentView === 'mission' && onInitMission) {
            onInitMission(assignmentMode, ids);
        } else if (currentView === 'hybrid' && onInitHybrid) {
            onInitHybrid(assignmentMode, ids);
        } else if (currentView === 'bracket' && onInitBracket) {
            onInitBracket(assignmentMode, ids);
        } else if (currentView === 'fullleague' && onInitFullLeague) {
            onInitFullLeague(assignmentMode, ids);
        } else if (currentView === 'doubleelim' && onInitDoubleElim) {
            onInitDoubleElim(assignmentMode, ids);
        }
    };

    const isUnchanged = useMemo(() => {
        if (selectedIds.size !== participantIds.length) return false;
        return participantIds.every(id => selectedIds.has(id));
    }, [selectedIds, participantIds]);

    const showFinalizeButton =
        currentView === 'relay' ||
        currentView === 'swiss' ||
        currentView === 'mission' ||
        currentView === 'hybrid' ||
        currentView === 'fullleague' ||
        currentView === 'doubleelim' ||
        currentView === 'bracket';
    const showAssignmentOptions = showFinalizeButton;

    const swissGroupHint = useMemo(() => {
        if (currentView !== 'swiss' || !tournamentSettings?.swissUseGroups) return null;
        const sizes = parseSwissGroupSizes(tournamentSettings.swissGroupSizes);
        const sum = sizes.reduce((a, b) => a + b, 0);
        return { sizes, sum };
    }, [currentView, tournamentSettings?.swissUseGroups, tournamentSettings?.swissGroupSizes]);

    let finalizeButtonText = '시작';
    if (currentView === 'relay') finalizeButtonText = '배정';
    else if (currentView === 'swiss') finalizeButtonText = '스위스 리그 시작';
    else if (currentView === 'mission') finalizeButtonText = '미션 바둑 시작';
    else if (currentView === 'hybrid') finalizeButtonText = '예선 리그 생성';
    else if (currentView === 'fullleague') finalizeButtonText = '풀리그 시작';
    else if (currentView === 'doubleelim') finalizeButtonText = '더블엘리미네이션 시작';
    else if (currentView === 'bracket') finalizeButtonText = '대진표 생성';

    return (
        <ModalShell
            title="대회 선수 관리"
            size="lg"
            onClose={onClose}
            dismissible={false}
            className="tournament-player-mgmt-modal"
            bodyClassName="tournament-player-mgmt-body"
            footer={
                <>
                    <div className="tournament-player-mgmt-actions-main">
                        <button type="button" className="btn" onClick={onClose}>
                            취소
                        </button>
                        <button type="button" className="btn" onClick={handleSaveAndClose} disabled={isUnchanged}>
                            참가자 목록 저장
                        </button>
                    </div>
                    {showFinalizeButton && (
                        <div className="tournament-player-mgmt-actions-finalize">
                            {showAssignmentOptions && (
                                <div className="tournament-player-mgmt-assign">
                                    <label htmlFor="assignment-mode">배정/시드</label>
                                    <select
                                        id="assignment-mode"
                                        value={assignmentMode}
                                        onChange={e => setAssignmentMode(e.target.value as 'random' | 'ranked')}
                                    >
                                        <option value="ranked">급수 순</option>
                                        <option value="random">무작위</option>
                                    </select>
                                </div>
                            )}
                            <button type="button" className="btn primary" onClick={handleFinalize}>
                                {finalizeButtonText} ({selectedIds.size}명)
                            </button>
                        </div>
                    )}
                </>
            }
        >
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
                                <div className="player-mgmt-header-actions">
                                    <button className="btn-sm" onClick={handleSelectAll}>전체 선택</button>
                                </div>
                            </div>
                            <ul className="player-mgmt-list">
                                {availableStudents.map(student => (
                                    <li
                                        key={student.id}
                                        className={`player-mgmt-item ${selectedIds.has(student.id) ? 'selected' : ''}`}
                                        onClick={() => handleToggleStudent(student.id)}
                                    >
                                        <span className="player-mgmt-item-text" title={`${student.name} (${student.rank})`}>
                                            <span className="player-mgmt-name">{student.name}</span>
                                            <small className="player-mgmt-rank">({student.rank})</small>
                                        </span>
                                        {selectedIds.has(student.id) && <span className="player-mgmt-check" aria-hidden>✔</span>}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        
                        <div className="player-mgmt-col">
                            <div className="player-mgmt-header">
                                참가 예정 선수 ({selectedIds.size}명)
                                <div className="player-mgmt-header-actions">
                                    <button className="btn-sm" onClick={handleDeselectAll}>전체 해제</button>
                                </div>
                            </div>
                            <ul className="player-mgmt-list">
                                {selectedStudentsList.map(student => (
                                    <li key={student.id} className="player-mgmt-item" onClick={() => handleToggleStudent(student.id)}>
                                        <span className="player-mgmt-item-text" title={`${student.name} (${student.rank})`}>
                                            <span className="player-mgmt-name">{student.name}</span>
                                            <small className="player-mgmt-rank">({student.rank})</small>
                                        </span>
                                    </li>
                                ))}
                                {selectedStudentsList.length === 0 && (
                                    <li className="player-mgmt-empty">선택된 선수가 없습니다.</li>
                                )}
                            </ul>
                        </div>
                    </div>

                    {showFinalizeButton && swissGroupHint && (
                        <div className="tournament-player-mgmt-hint">
                            조별 스위스: 대회 설정 조 인원 합 <strong>{swissGroupHint.sum}</strong>명 — 참가 예정{' '}
                            <strong>{selectedIds.size}</strong>명
                            {swissGroupHint.sum !== selectedIds.size ? (
                                <span className="tournament-player-mgmt-hint-warn"> (합이 같아야 시작할 수 있습니다)</span>
                            ) : null}
                        </div>
                    )}
        </ModalShell>
    );
};
