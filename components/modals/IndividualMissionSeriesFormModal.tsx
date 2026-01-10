import React, { useState, useEffect } from 'react';
import type { IndividualMissionSeries, IndividualMissionStep } from '../../types';
import { generateId } from '../../utils';

interface IndividualMissionSeriesFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (series: Omit<IndividualMissionSeries, 'id'>, seriesIdToEdit: string | null) => void;
    seriesToEdit?: IndividualMissionSeries | null;
}

const DragHandle = () => (
    <svg className="drag-handle" width="24" height="24" viewBox="0 0 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ cursor: 'grab', alignSelf: 'center' }}>
        <path d="M9 4V6m0 2V10m0 2v2m0 2v2m6-12V6m0 2V10m0 2v2m0 2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);


export const IndividualMissionSeriesFormModal = ({ isOpen, onClose, onSave, seriesToEdit }: IndividualMissionSeriesFormModalProps) => {
    const [name, setName] = useState('');
    const [steps, setSteps] = useState<IndividualMissionStep[]>([]);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

    useEffect(() => {
        if (seriesToEdit) {
            setName(seriesToEdit.name);
            setSteps(seriesToEdit.steps);
        } else {
            setName('');
            setSteps([{ id: generateId(), description: '', stones: 5 }]);
        }
    }, [seriesToEdit, isOpen]);

    if (!isOpen) return null;

    const handleStepChange = (index: number, field: keyof Omit<IndividualMissionStep, 'id'>, value: string) => {
        const newSteps = [...steps];
        if (field === 'stones') {
            newSteps[index] = { ...newSteps[index], [field]: Number(value) };
        } else if (field === 'description') {
            newSteps[index] = { ...newSteps[index], [field]: value };
        }
        setSteps(newSteps);
    };

    const handleAddStep = () => {
        setSteps([...steps, { id: generateId(), description: '', stones: 5 }]);
    };
    
    const handleRemoveStep = (index: number) => {
        if (steps.length > 1) {
            setSteps(steps.filter((_, i) => i !== index));
        } else {
            alert('미션은 최소 1개 이상이어야 합니다.');
        }
    };

    // --- DND Handlers ---
    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        (e.currentTarget as HTMLElement).classList.add('dragging');
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDragEnter = (e: React.DragEvent, index: number) => {
        if (draggedIndex !== null && draggedIndex !== index) {
            (e.currentTarget as HTMLElement).classList.add('drag-over-indicator');
        }
    };
    
    const handleDragLeave = (e: React.DragEvent) => {
         (e.currentTarget as HTMLElement).classList.remove('drag-over-indicator');
    };
    
    const handleDrop = (e: React.DragEvent, targetIndex: number) => {
        e.preventDefault();
        (e.currentTarget as HTMLElement).classList.remove('drag-over-indicator');
        if (draggedIndex === null) return;
        
        const newSteps = [...steps];
        const [draggedItem] = newSteps.splice(draggedIndex, 1);
        newSteps.splice(targetIndex, 0, draggedItem);
        
        setSteps(newSteps);
        setDraggedIndex(null);
    };

    const handleDragEnd = (e: React.DragEvent) => {
        (e.currentTarget as HTMLElement).classList.remove('dragging');
        setDraggedIndex(null);
         document.querySelectorAll('.drag-over-indicator').forEach(el => el.classList.remove('drag-over-indicator'));
    };
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            alert('미션 시리즈 이름을 입력해주세요.');
            return;
        }
        if (steps.some(step => !step.description.trim() || step.stones <= 0)) {
            alert('모든 미션 단계의 내용과 보상 스톤을 올바르게 입력해주세요.');
            return;
        }
        onSave({ name, steps }, seriesToEdit ? seriesToEdit.id : null);
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <h2>{seriesToEdit ? '개인 미션 시리즈 수정' : '새 개인 미션 시리즈 추가'}</h2>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-group">
                            <label htmlFor="series-name">미션 시리즈 이름</label>
                            <input
                                type="text"
                                id="series-name"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="예: 정석 외우기"
                                required
                            />
                        </div>
                        <hr style={{margin: '1.5rem 0', border: 'none', borderTop: '1px solid var(--border-color)'}}/>
                        
                        <h4>미션 단계 (드래그하여 순서 변경)</h4>
                        {steps.map((step, index) => (
                            <div 
                                key={step.id} 
                                className="settings-form-row" 
                                style={{alignItems: 'center', borderBottom: '1px solid var(--bg-color)', paddingBottom: '1rem', gridTemplateColumns: 'auto 1fr'}}
                                draggable
                                onDragStart={e => handleDragStart(e, index)}
                                onDragEnter={e => handleDragEnter(e, index)}
                                onDragLeave={handleDragLeave}
                                onDragOver={handleDragOver}
                                onDrop={e => handleDrop(e, index)}
                                onDragEnd={handleDragEnd}
                            >
                                <DragHandle />
                                <div className="input-group" style={{flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem'}}>
                                     <label style={{fontWeight: 'bold', color: 'var(--text-color)'}}>{index + 1}단계</label>
                                    <input
                                        type="text"
                                        value={step.description}
                                        onChange={e => handleStepChange(index, 'description', e.target.value)}
                                        placeholder="미션 내용 (예: 1번 정석 외우기)"
                                        required
                                    />
                                    <div style={{display: 'flex', gap: '0.5rem', alignItems: 'center'}}>
                                         <input
                                            type="number"
                                            value={step.stones}
                                            onChange={e => handleStepChange(index, 'stones', e.target.value)}
                                            min="1"
                                            placeholder="보상 스톤"
                                            required
                                            style={{maxWidth: '100px'}}
                                        />
                                        <span>스톤</span>
                                        <button type="button" className="btn-sm danger" style={{marginLeft: 'auto'}} onClick={() => handleRemoveStep(index)}>삭제</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                         <div style={{ textAlign: 'right', marginTop: '1rem' }}>
                            <button type="button" className="btn-sm" onClick={handleAddStep}>단계 추가</button>
                        </div>
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