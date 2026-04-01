
import React, { useMemo, useState } from 'react';
import type { SpecialMission, GroupSettings, GeneralSettings } from '../../types';
import { generateId } from '../../utils';
import { MISSION_ALL_GROUPS } from '../../utils/missionVisibility';

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

function visibleGroupsForEditor(m: SpecialMission, groupOrder: string[]): string[] {
    if (m.visibleGroups && m.visibleGroups.length > 0) return [...m.visibleGroups];
    if (m.group) return [m.group];
    return [MISSION_ALL_GROUPS];
}

export const SpecialMissionManagerModal = ({
    isOpen,
    onClose,
    specialMissions,
    onUpdateSpecialMissions,
    groupSettings,
    groupOrder,
    generalSettings,
    onUpdateGeneralSettings
}: SpecialMissionManagerModalProps) => {
    const [activeTab, setActiveTab] = useState<'list' | 'probability'>('list');
    const [activeGroup, setActiveGroup] = useState(groupOrder[0] || '');
    const [isAdding, setIsAdding] = useState(false);
    const [editingMissionId, setEditingMissionId] = useState<string | null>(null);

    const [formData, setFormData] = useState<Omit<SpecialMission, 'id'>>({
        content: '',
        stars: 3,
        stones: 10,
        answer: '',
        visibleGroups: [MISSION_ALL_GROUPS],
    });

    const sortedMissions = useMemo(() => {
        return [...specialMissions].sort((a, b) => b.stars - a.stars || a.content.localeCompare(b.content));
    }, [specialMissions]);

    if (!isOpen) return null;

    const setMissionVisibleGroups = (missionId: string, nextRaw: string[]) => {
        let next = nextRaw.includes(MISSION_ALL_GROUPS)
            ? [MISSION_ALL_GROUPS]
            : [...new Set(nextRaw)];
        if (!next.includes(MISSION_ALL_GROUPS) && next.length === 0) {
            next = groupOrder[0] ? [groupOrder[0]] : [MISSION_ALL_GROUPS];
        }
        const legacyGroup = next.includes(MISSION_ALL_GROUPS) ? undefined : next[0];
        onUpdateSpecialMissions(specialMissions.map(m => {
            if (m.id !== missionId) return m;
            return {
                ...m,
                visibleGroups: next,
                group: legacyGroup,
                isExclusive: undefined,
                isAtLeast: undefined,
            };
        }));
    };

    const toggleGroupOnMission = (m: SpecialMission, groupKey: string) => {
        const cur = visibleGroupsForEditor(m, groupOrder);
        if (cur.includes(MISSION_ALL_GROUPS)) {
            setMissionVisibleGroups(m.id, [groupKey]);
            return;
        }
        const has = cur.includes(groupKey);
        const next = has ? cur.filter(g => g !== groupKey) : [...cur, groupKey];
        setMissionVisibleGroups(m.id, next.length === 0 ? [MISSION_ALL_GROUPS] : next);
    };

    const toggleAllOnMission = (m: SpecialMission, checked: boolean) => {
        if (checked) {
            setMissionVisibleGroups(m.id, [MISSION_ALL_GROUPS]);
        } else {
            setMissionVisibleGroups(m.id, groupOrder[0] ? [groupOrder[0]] : [MISSION_ALL_GROUPS]);
        }
    };

    const resetForm = () => {
        setFormData({
            content: '',
            stars: 3,
            stones: 10,
            answer: '',
            visibleGroups: [MISSION_ALL_GROUPS],
        });
        setIsAdding(false);
        setEditingMissionId(null);
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.content.trim()) return;
        const vg = formData.visibleGroups?.includes(MISSION_ALL_GROUPS)
            ? [MISSION_ALL_GROUPS]
            : (formData.visibleGroups && formData.visibleGroups.length > 0
                ? [...new Set(formData.visibleGroups)]
                : [MISSION_ALL_GROUPS]);
        const legacyGroup = vg.includes(MISSION_ALL_GROUPS) ? undefined : vg[0];
        const payload: SpecialMission = {
            ...formData,
            content: formData.content.trim(),
            visibleGroups: vg,
            group: legacyGroup,
            isExclusive: undefined,
            isAtLeast: undefined,
            id: editingMissionId || generateId(),
        };

        if (editingMissionId) {
            onUpdateSpecialMissions(specialMissions.map(m => m.id === editingMissionId ? payload : m));
        } else {
            onUpdateSpecialMissions([...specialMissions, payload]);
        }
        resetForm();
    };

    const handleEdit = (mission: SpecialMission) => {
        setFormData({
            content: mission.content,
            stars: mission.stars,
            stones: mission.stones,
            answer: mission.answer || '',
            visibleGroups: visibleGroupsForEditor(mission, groupOrder),
            group: mission.group,
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
        const percentage = Math.min(100, Math.max(0, parseInt(value, 10) || 0));
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

    const renderGroupPickers = (value: string[], onChange: (next: string[]) => void) => {
        const isAll = value.includes(MISSION_ALL_GROUPS);
        return (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontWeight: 600 }}>
                    <input
                        type="checkbox"
                        checked={isAll}
                        onChange={e => onChange(e.target.checked ? [MISSION_ALL_GROUPS] : (groupOrder[0] ? [groupOrder[0]] : [MISSION_ALL_GROUPS]))}
                    />
                    공동(전체)
                </label>
                {groupOrder.map(gk => (
                    <label key={gk} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={!isAll && value.includes(gk)}
                            onChange={() => {
                                if (isAll) onChange([gk]);
                                else {
                                    const has = value.includes(gk);
                                    const next = has ? value.filter(x => x !== gk) : [...value, gk];
                                    onChange(next.length === 0 ? [MISSION_ALL_GROUPS] : next);
                                }
                            }}
                        />
                        {groupSettings[gk]?.name || gk}
                    </label>
                ))}
            </div>
        );
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '960px' }}>
                <h2>특별 미션 관리</h2>

                <div className="sidebar-tabs" style={{ marginBottom: '1.5rem' }}>
                    <button type="button" className={`tab-item ${activeTab === 'list' ? 'active' : ''}`} onClick={() => setActiveTab('list')}>미션 목록</button>
                    <button type="button" className={`tab-item ${activeTab === 'probability' ? 'active' : ''}`} onClick={() => setActiveTab('probability')}>출현 확률 설정</button>
                </div>

                {activeTab === 'probability' && (
                    <div className="view-toggle" style={{ marginBottom: '1.5rem' }}>
                        {groupOrder.map(g => (
                            <button
                                type="button"
                                key={g}
                                className={`toggle-btn ${activeGroup === g ? 'active' : ''}`}
                                onClick={() => setActiveGroup(g)}
                            >
                                {groupSettings[g]?.name || g}
                            </button>
                        ))}
                    </div>
                )}

                {activeTab === 'list' ? (
                    <>
                        {isAdding ? (
                            <form onSubmit={handleSave} className="settings-card" style={{ marginBottom: '1.5rem' }}>
                                <h4>{editingMissionId ? '미션 수정' : '새 특별 미션 추가'}</h4>
                                <div className="form-group">
                                    <label>노출 반</label>
                                    {renderGroupPickers(formData.visibleGroups || [MISSION_ALL_GROUPS], (next) => {
                                        setFormData({
                                            ...formData,
                                            visibleGroups: next.includes(MISSION_ALL_GROUPS) ? [MISSION_ALL_GROUPS] : (next.length ? next : [MISSION_ALL_GROUPS]),
                                        });
                                    })}
                                </div>
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
                                            onChange={e => setFormData({ ...formData, stars: parseInt(e.target.value, 10) })}
                                        >
                                            {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{'★'.repeat(n)} ({n}개)</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>보상 스톤</label>
                                        <input
                                            type="number"
                                            value={formData.stones}
                                            onChange={e => setFormData({ ...formData, stones: parseInt(e.target.value, 10) || 0 })}
                                            min={1}
                                        />
                                    </div>
                                </div>
                                <div className="modal-actions" style={{ marginTop: '1rem', borderTop: 'none', padding: 0 }}>
                                    <button type="button" className="btn" onClick={resetForm}>취소</button>
                                    <button type="submit" className="btn primary">저장</button>
                                </div>
                            </form>
                        ) : (
                            <div style={{ textAlign: 'right', marginBottom: '1rem' }}>
                                <button type="button" className="btn primary" onClick={() => { resetForm(); setIsAdding(true); }}>+ 미션 추가</button>
                            </div>
                        )}

                        <div className="item-list" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                            {sortedMissions.map(m => {
                                const v = visibleGroupsForEditor(m, groupOrder);
                                const allChecked = v.includes(MISSION_ALL_GROUPS);
                                return (
                                    <div key={m.id} className="item-card" style={{ padding: '1rem', marginBottom: '0.5rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                                            <div style={{ flex: '1 1 220px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
                                                    <p style={{ fontWeight: 'bold', margin: 0 }}>{m.content}</p>
                                                </div>
                                                {m.answer && <p style={{ fontSize: '0.85rem', color: '#666', fontStyle: 'italic', margin: '0 0 0.3rem 0' }}>답: {m.answer}</p>}
                                                <p style={{ fontSize: '0.9rem', color: 'var(--accent-color)', margin: 0 }}>
                                                    {'★'.repeat(m.stars)} <span style={{ color: '#888', marginLeft: '0.5rem' }}>{m.stones} 스톤</span>
                                                </p>
                                            </div>
                                            <div className="item-actions" style={{ display: 'flex', gap: '0.35rem', alignItems: 'flex-start' }}>
                                                <button type="button" className="btn-sm" onClick={() => handleEdit(m)}>수정</button>
                                                <button type="button" className="btn-sm danger" onClick={() => handleDelete(m.id)}>삭제</button>
                                            </div>
                                        </div>
                                        <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>노출 반</span>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem 0.75rem', alignItems: 'center' }}>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', fontWeight: 600 }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={allChecked}
                                                        onChange={e => toggleAllOnMission(m, e.target.checked)}
                                                    />
                                                    공동
                                                </label>
                                                {groupOrder.map(gk => (
                                                    <label key={`${m.id}-${gk}`} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={!allChecked && v.includes(gk)}
                                                            onChange={() => toggleGroupOnMission(m, gk)}
                                                        />
                                                        {groupSettings[gk]?.name || gk}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {sortedMissions.length === 0 && !isAdding && (
                                <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>등록된 특별 미션이 없습니다.</p>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="settings-card">
                        <h4>{groupSettings[activeGroup]?.name || activeGroup}반 미션 확률 설정</h4>
                        <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1rem' }}>
                            ★5 → ★2 순으로 각 난이도별 확률(%)을 적용해 시도합니다. 해당 별 미션이 풀에 없으면 건너뜁니다.
                            모두 통과하지 못하면, 노출 가능한 미션 중 <strong>가장 낮은 별(가장 쉬운 난이도)</strong>에서 반드시 하나가 선택됩니다.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {[5, 4, 3, 2, 1].map(starCount => (
                                <div key={starCount} style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', background: '#f8f9fa', padding: '0.8rem 1.2rem', borderRadius: '10px' }}>
                                    <div style={{ width: '120px', fontWeight: 'bold', color: 'var(--accent-color)' }}>
                                        {'★'.repeat(starCount)}
                                        {starCount === 1 && <span style={{ fontSize: '0.75rem', color: '#666', fontWeight: 'normal', display: 'block' }}>(최종 보장)</span>}
                                    </div>
                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <input
                                            type="range"
                                            min={0}
                                            max={100}
                                            value={getGroupWeights(activeGroup)[starCount]}
                                            onChange={e => handleWeightChange(activeGroup, starCount, e.target.value)}
                                            style={{ flex: 1 }}
                                            disabled={starCount === 1}
                                        />
                                        <div style={{ width: '60px', textAlign: 'right' }}>
                                            <input
                                                type="number"
                                                min={0}
                                                max={100}
                                                value={getGroupWeights(activeGroup)[starCount]}
                                                onChange={e => handleWeightChange(activeGroup, starCount, e.target.value)}
                                                style={{ width: '100%', padding: '4px', textAlign: 'center', borderRadius: '4px', border: '1px solid #ddd' }}
                                                disabled={starCount === 1}
                                            />
                                        </div>
                                        <span style={{ fontWeight: 'bold' }}>%</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#e3f2fd', borderRadius: '8px', border: '1px solid #90caf9' }}>
                            <p style={{ margin: 0, fontSize: '0.88rem', color: '#1565c0' }}>
                                ★1 구간은 “모든 시도가 실패했을 때” 선택되는 <strong>최종 안전망</strong>이라 확률 입력은 비활성화되어 있습니다.
                                (★5~★2에서 한 번도 선택되지 않으면, 후보 중 가장 쉬운 난이도에서 무조건 뽑힙니다.)
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
