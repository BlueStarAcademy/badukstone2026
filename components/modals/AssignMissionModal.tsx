import React, { useState, useEffect } from 'react';
import type { Student, IndividualMissionSeries, StudentMissionProgress } from '../../types';

interface AssignMissionModalProps {
    isOpen: boolean;
    onClose: () => void;
    student: Student;
    allSeries: IndividualMissionSeries[];
    studentProgress: StudentMissionProgress | null;
    onAssign: (studentId: string, seriesId: string, currentStepIndex: number) => void;
    onUnassign: (studentId: string) => void;
}

export const AssignMissionModal = ({ isOpen, onClose, student, allSeries, studentProgress, onAssign, onUnassign }: AssignMissionModalProps) => {
    const [selectedSeriesId, setSelectedSeriesId] = useState('');
    const [stepNumber, setStepNumber] = useState(1);

    // FIX: Access the specific student's progress from the studentProgress map.
    const progress = studentProgress?.[student.id];

    useEffect(() => {
        if (isOpen) {
            // FIX: Use the derived `progress` object for the specific student.
            if (progress) {
                setSelectedSeriesId(progress.missionSeriesId);
                setStepNumber(progress.currentStepIndex + 1);
            } else {
                const firstSeriesId = allSeries[0]?.id || '';
                setSelectedSeriesId(firstSeriesId);
                setStepNumber(1);
            }
        }
    }, [progress, allSeries, isOpen]);
    
    useEffect(() => {
        if (isOpen) {
            // FIX: Use the derived `progress` object for the specific student.
            if (progress && selectedSeriesId === progress.missionSeriesId) {
                setStepNumber(progress.currentStepIndex + 1);
            } else {
                setStepNumber(1);
            }
        }
    }, [selectedSeriesId, isOpen, progress]);


    if (!isOpen) return null;

    const selectedSeries = allSeries.find(s => s.id === selectedSeriesId);
    const maxSteps = selectedSeries ? selectedSeries.steps.length : 1;

    const handleStepNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = parseInt(e.target.value, 10);
        if (isNaN(value) || value < 1) {
            value = 1;
        } else if (value > maxSteps) {
            value = maxSteps;
        }
        setStepNumber(value);
    };

    const handleAssign = () => {
        if (!selectedSeriesId || !selectedSeries) {
            alert('할당할 미션 시리즈를 선택해주세요.');
            return;
        }
        const stepIndex = Math.max(0, Math.min(stepNumber - 1, maxSteps - 1));
        onAssign(student.id, selectedSeriesId, stepIndex);
        onClose();
    };

    const handleUnassign = () => {
        onUnassign(student.id);
        onClose();
    };

    // FIX: Use the derived `progress` object for the specific student.
    const isUnchanged = progress &&
                        selectedSeriesId === progress.missionSeriesId &&
                        stepNumber === progress.currentStepIndex + 1;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h2>{student.name} 학생에게 개인 미션 할당</h2>
                <div className="modal-body">
                    {/* FIX: Use the derived `progress` object for the specific student. */}
                    {progress ? (
                        <div>
                            <p><strong>현재 진행중인 미션:</strong> {allSeries.find(s => s.id === progress.missionSeriesId)?.name}</p>
                            <hr style={{margin: '1rem 0'}} />
                            <p>다른 미션을 할당하면 현재 진행 상태가 초기화됩니다.</p>
                        </div>
                    ) : (
                        <p>현재 할당된 개인 미션이 없습니다.</p>
                    )}
                    <div className="form-group">
                        <label htmlFor="mission-series-select">미션 시리즈 선택</label>
                        <select
                            id="mission-series-select"
                            value={selectedSeriesId}
                            onChange={e => setSelectedSeriesId(e.target.value)}
                        >
                             {allSeries.map(series => (
                                <option key={series.id} value={series.id}>{series.name}</option>
                            ))}
                        </select>
                    </div>
                     <div className="form-group">
                        <label htmlFor="mission-step-number">현재 단계 번호</label>
                        <input
                            type="number"
                            id="mission-step-number"
                            value={stepNumber}
                            onChange={handleStepNumberChange}
                            min="1"
                            max={maxSteps}
                            disabled={!selectedSeriesId}
                        />
                        {selectedSeries && <small>총 {maxSteps}단계 중 현재 진행할 단계를 입력하세요.</small>}
                    </div>
                </div>
                <div className="modal-actions" style={{justifyContent: 'space-between'}}>
                    <div>
                         {/* FIX: Use the derived `progress` object for the specific student. */}
                         {progress && (
                            <button type="button" className="btn danger" onClick={handleUnassign}>할당 해제</button>
                        )}
                    </div>
                    <div>
                        <button type="button" className="btn" onClick={onClose}>취소</button>
                        {/* FIX: Use the derived `progress` object for the specific student. */}
                        <button type="button" className="btn primary" onClick={handleAssign} disabled={!selectedSeriesId || isUnchanged}>
                            {progress ? '변경하기' : '할당하기'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};