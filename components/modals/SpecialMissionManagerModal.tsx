
import React, { useState, useMemo } from 'react';
import type { SpecialMission, GroupSettings } from '../../types';
import { generateId } from '../../utils';

interface SpecialMissionManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    specialMissions: SpecialMission[];
    onUpdateSpecialMissions: (missions: SpecialMission[]) => void;
    groupSettings: GroupSettings;
    groupOrder: string[];
}

export const SpecialMissionManagerModal = ({ 
    isOpen, onClose, specialMissions, onUpdateSpecialMissions, groupSettings, groupOrder 
}: SpecialMissionManagerModalProps) => {
    const [activeGroup, setActiveGroup] = useState(groupOrder[0] || '전체');
    const [isAdding, setIsAdding] = useState(false);
    const [editingMissionId, setEditingMissionId] = useState<string | null>(null);

    const [formData, setFormData] = useState<Omit<SpecialMission, 'id'>>({
        content: '',
        group: groupOrder[0] || '',
        stars: 3,
        stones: 10,
        answer: '',
        isExclusive: false
    });

    const filteredMissions = useMemo(() => {
        return specialMissions.filter(m => m.group === activeGroup);
    }, [specialMissions, activeGroup]);

    if (!isOpen) return null;

    const resetForm = (group: string) => {
        setFormData({ content: '', group, stars: 3, stones: 10, answer: '', isExclusive: false });
        setIsAdding(false);
        setEditingMissionId(null);
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.content.trim()) return;

        if (editingMissionId) {
            onUpdateSpecialMissions(specialMissions.map(m => 
                m.id === editingMissionId ? { ...formData, id: editingMissionId } : m
            ));
        } else {
            onUpdateSpecialMissions([...specialMissions, { ...formData, id: generateId() }]);
        }
        resetForm(activeGroup);
    };

    const handleEdit = (mission: SpecialMission) => {
        setFormData({ 
            content: mission.content, 
            group: mission.group, 
            stars: mission.stars, 
            stones: mission.stones, 
            answer: mission.answer || '',
            isExclusive: !!mission.isExclusive
        });
        setEditingMissionId(mission.id);
        setIsAdding(true);
    };

    const handleDelete = (id: string) => {
        if (confirm('정말 삭제하시겠습니까?')) {
            onUpdateSpecialMissions(specialMissions.filter(m => m.id !== id));
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px' }}>
                <h2>특별 미션 관리</h2>
                <div className="view-toggle" style={{ marginBottom: '1.5rem' }}>
                    {groupOrder.map(g => (
                        <button 
                            key={g} 
                            className={`toggle-btn ${activeGroup === g ? 'active' : ''}`}
                            onClick={() => { setActiveGroup(g); resetForm(g); }}
                        >
                            {groupSettings[g]?.name || g}
                        </button>
                    ))}
                </div>

                {isAdding ? (
                    <form onSubmit={handleSave} className="settings-card" style={{ marginBottom: '1.5rem' }}>
                        <h4>{editingMissionId ? '미션 수정' : '새 특별 미션 추가'}</h4>
                        <div className="form-group">
                            <label>미션 내용</label>
                            <input 
                                type="text" 
                                value={formData.content} 
                                onChange={e => setFormData({ ...formData, content: e.target.value })} 
                                placeholder="예: 3연승 달성하기" 
                                required 
                            />
                        </div>
                        <div className="form-group">
                            <label>정답 (선택)</label>
                            <textarea 
                                value={formData.answer} 
                                onChange={e => setFormData({ ...formData, answer: e.target.value })} 
                                placeholder="정답 또는 해설을 입력하세요" 
                                rows={3}
                                style={{ width: '100%', padding: '0.8rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                            />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label>난이도 (별 개수)</label>
                                <select 
                                    value={formData.stars} 
                                    onChange={e => setFormData({ ...formData, stars: parseInt(e.target.value) })}
                                >
                                    {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{'★'.repeat(n)} ({n}개)</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>보상 스톤</label>
                                <input 
                                    type="number" 
                                    value={formData.stones} 
                                    onChange={e => setFormData({ ...formData, stones: parseInt(e.target.value) || 0 })} 
                                    min="1" 
                                />
                            </div>
                        </div>
                        <div className="form-group-checkbox" style={{ marginBottom: '1.5rem' }}>
                            <input 
                                type="checkbox" 
                                id="is-exclusive" 
                                checked={formData.isExclusive} 
                                onChange={e => setFormData({ ...formData, isExclusive: e.target.checked })} 
                            />
                            <label htmlFor="is-exclusive">
                                <strong>급수 전용 미션</strong> (상위 그룹 학생이 뽑을 수 없게 제한)
                            </label>
                        </div>
                        <div className="modal-actions" style={{ marginTop: '1rem', borderTop: 'none', padding: 0 }}>
                            <button type="button" className="btn" onClick={() => resetForm(activeGroup)}>취소</button>
                            <button type="submit" className="btn primary">저장</button>
                        </div>
                    </form>
                ) : (
                    <div style={{ textAlign: 'right', marginBottom: '1rem' }}>
                        <button className="btn primary" onClick={() => setIsAdding(true)}>+ 미션 추가</button>
                    </div>
                )}

                <div className="item-list" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    {filteredMissions.map(m => (
                        <div key={m.id} className="item-card" style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', marginBottom: '0.5rem' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.3rem' }}>
                                    <p style={{ fontWeight: 'bold', margin: 0 }}>{m.content}</p>
                                    {m.isExclusive && <span className="status-badge" style={{ fontSize: '0.7rem', padding: '2px 6px', background: '#e3f2fd', color: '#1976d2', border: '1px solid #bbdefb' }}>전용</span>}
                                </div>
                                {m.answer && <p style={{ fontSize: '0.85rem', color: '#666', fontStyle: 'italic', margin: '0 0 0.3rem 0' }}>답: {m.answer}</p>}
                                <p style={{ fontSize: '0.9rem', color: 'var(--accent-color)', margin: 0 }}>
                                    {'★'.repeat(m.stars)} <span style={{ color: '#888', marginLeft: '0.5rem' }}>{m.stones} 스톤</span>
                                </p>
                            </div>
                            <div className="item-actions">
                                <button className="btn-sm" onClick={() => handleEdit(m)}>수정</button>
                                <button className="btn-sm danger" onClick={() => handleDelete(m.id)}>삭제</button>
                            </div>
                        </div>
                    ))}
                    {filteredMissions.length === 0 && !isAdding && (
                        <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>등록된 특별 미션이 없습니다.</p>
                    )}
                </div>

                <div className="modal-actions">
                    <button type="button" className="btn primary" onClick={onClose}>닫기</button>
                </div>
            </div>
        </div>
    );
};
