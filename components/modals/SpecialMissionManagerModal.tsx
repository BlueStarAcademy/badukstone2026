
import React, { useState, useMemo } from 'react';
import type { SpecialMission, GroupSettings, GeneralSettings } from '../../types';
import { generateId } from '../../utils';

interface SpecialMissionManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    specialMissions: SpecialMission[];
    onUpdateSpecialMissions: (missions: SpecialMission[]) => void;
    groupSettings: GroupSettings;
    groupOrder: string[];
    generalSettings: GeneralSettings;
    onUpdateGeneralSettings: (settings: GeneralSettings) => void;
}

export const SpecialMissionManagerModal = ({ 
    isOpen, onClose, specialMissions, onUpdateSpecialMissions, groupSettings, groupOrder, generalSettings, onUpdateGeneralSettings 
}: SpecialMissionManagerModalProps) => {
    const [activeTab, setActiveTab] = useState<'list' | 'probability'>('list');
    const [activeGroup, setActiveGroup] = useState(groupOrder[0] || '전체');
    const [isAdding, setIsAdding] = useState(false);
    const [editingMissionId, setEditingMissionId] = useState<string | null>(null);

    const [formData, setFormData] = useState<Omit<SpecialMission, 'id'>>({
        content: '',
        group: groupOrder[0] || '',
        stars: 3,
        stones: 10,
        answer: '',
        isExclusive: false,
        isAtLeast: false
    });

    const filteredMissions = useMemo(() => {
        return specialMissions.filter(m => m.group === activeGroup);
    }, [specialMissions, activeGroup]);

    if (!isOpen) return null;

    const resetForm = (group: string) => {
        setFormData({ content: '', group, stars: 3, stones: 10, answer: '', isExclusive: false, isAtLeast: false });
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
            isExclusive: !!mission.isExclusive,
            isAtLeast: !!mission.isAtLeast
        });
        setEditingMissionId(mission.id);
        setIsAdding(true);
    };

    const handleDelete = (id: string) => {
        if (confirm('정말 삭제하시겠습니까?')) {
            onUpdateSpecialMissions(specialMissions.filter(m => m.id !== id));
        }
    };

    const handleWeightChange = (group: string, stars: number, value: string) => {
        const percentage = Math.min(100, Math.max(0, parseInt(value) || 0));
        const newWeights = { ...(generalSettings.specialMissionWeights || {}) };
        if (!newWeights[group]) newWeights[group] = { 1: 20, 2: 20, 3: 20, 4: 20, 5: 20 };
        
        newWeights[group] = { ...newWeights[group], [stars]: percentage };
        
        onUpdateGeneralSettings({
            ...generalSettings,
            specialMissionWeights: newWeights
        });
    };

    const getGroupWeights = (group: string) => {
        return (generalSettings.specialMissionWeights && generalSettings.specialMissionWeights[group]) 
            ? generalSettings.specialMissionWeights[group] 
            : { 1: 20, 2: 20, 3: 20, 4: 20, 5: 20 };
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '900px' }}>
                <h2>특별 미션 관리</h2>
                
                <div className="sidebar-tabs" style={{ marginBottom: '1.5rem' }}>
                    <button className={`tab-item ${activeTab === 'list' ? 'active' : ''}`} onClick={() => setActiveTab('list')}>미션 목록</button>
                    <button className={`tab-item ${activeTab === 'probability' ? 'active' : ''}`} onClick={() => setActiveTab('probability')}>출현 확률 설정</button>
                </div>

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

                {activeTab === 'list' ? (
                    <>
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
                                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                    <div className="form-group-checkbox" style={{ marginBottom: '1rem' }}>
                                        <input 
                                            type="checkbox" 
                                            id="is-exclusive" 
                                            checked={formData.isExclusive} 
                                            onChange={e => setFormData({ ...formData, isExclusive: e.target.checked })} 
                                        />
                                        <label htmlFor="is-exclusive">
                                            <strong>상위 그룹 제한</strong> (상급자 참여 방지)
                                        </label>
                                    </div>
                                    <div className="form-group-checkbox" style={{ marginBottom: '1rem' }}>
                                        <input 
                                            type="checkbox" 
                                            id="is-at-least" 
                                            checked={formData.isAtLeast} 
                                            onChange={e => setFormData({ ...formData, isAtLeast: e.target.checked })} 
                                        />
                                        <label htmlFor="is-at-least">
                                            <strong>하위 그룹 제한</strong> (하급자 참여 방지)
                                        </label>
                                    </div>
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
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                {m.isExclusive && <span className="status-badge" style={{ fontSize: '0.7rem', padding: '2px 6px', background: '#fff3e0', color: '#e65100', border: '1px solid #ffe0b2' }}>상위제한</span>}
                                                {m.isAtLeast && <span className="status-badge" style={{ fontSize: '0.7rem', padding: '2px 6px', background: '#e3f2fd', color: '#1976d2', border: '1px solid #bbdefb' }}>하위제한</span>}
                                            </div>
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
                    </>
                ) : (
                    <div className="settings-card">
                        <h4>{groupSettings[activeGroup]?.name || activeGroup}반 미션 확률 설정</h4>
                        <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1.5rem' }}>각 난이도별(별 개수) 미션이 뽑힐 확률을 설정합니다. (단위: %)</p>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {[1, 2, 3, 4, 5].map(starCount => (
                                <div key={starCount} style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', background: '#f8f9fa', padding: '0.8rem 1.2rem', borderRadius: '10px' }}>
                                    <div style={{ width: '120px', fontWeight: 'bold', color: 'var(--accent-color)' }}>
                                        {'★'.repeat(starCount)}
                                    </div>
                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <input 
                                            type="range" 
                                            min="0" 
                                            max="100" 
                                            value={getGroupWeights(activeGroup)[starCount]} 
                                            onChange={e => handleWeightChange(activeGroup, starCount, e.target.value)}
                                            style={{ flex: 1 }}
                                        />
                                        <div style={{ width: '60px', textAlign: 'right' }}>
                                            <input 
                                                type="number" 
                                                min="0" 
                                                max="100" 
                                                value={getGroupWeights(activeGroup)[starCount]} 
                                                onChange={e => handleWeightChange(activeGroup, starCount, e.target.value)}
                                                style={{ width: '100%', padding: '4px', textAlign: 'center', borderRadius: '4px', border: '1px solid #ddd' }}
                                            />
                                        </div>
                                        <span style={{ fontWeight: 'bold' }}>%</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        <div style={{ marginTop: '2rem', padding: '1rem', background: '#fff9c4', borderRadius: '8px', border: '1px solid #fbc02d' }}>
                             <p style={{ margin: 0, fontSize: '0.9rem', color: '#827717' }}>
                                <strong>💡 안내:</strong> 설정된 모든 확률의 합이 100이 아니어도 작동합니다. (입력된 수치들의 비율로 계산됩니다.) 
                                특정 난이도의 미션이 아예 나오지 않게 하려면 0%로 설정하세요.
                             </p>
                        </div>
                    </div>
                )}

                <div className="modal-actions">
                    <button type="button" className="btn primary" onClick={onClose}>닫기</button>
                </div>
            </div>
        </div>
    );
};
