
import React, { useMemo, useState } from 'react';
import type { SpecialMission, GroupSettings, GeneralSettings } from '../../types';
import { generateId } from '../../utils';
import { MISSION_ALL_GROUPS } from '../../utils/missionVisibility';
import { ModalShell } from '../ui/ModalShell';

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

const STAR_LEVELS = [5, 4, 3, 2, 1] as const;

function normalizeGroupSelection(nextRaw: string[], groupOrder: string[]): string[] {
    let next = nextRaw.includes(MISSION_ALL_GROUPS)
        ? [MISSION_ALL_GROUPS]
        : [...new Set(nextRaw)];
    if (!next.includes(MISSION_ALL_GROUPS) && next.length === 0) {
        next = groupOrder[0] ? [groupOrder[0]] : [MISSION_ALL_GROUPS];
    }
    return next;
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
    const [activeTab, setActiveTab] = useState<'list' | 'appearance'>('list');
    const [activeGroup, setActiveGroup] = useState(groupOrder[0] || '');
    const [isAdding, setIsAdding] = useState(false);
    const [editingMissionId, setEditingMissionId] = useState<string | null>(null);

    const [formData, setFormData] = useState<Omit<SpecialMission, 'id'>>({
        content: '',
        stars: 3,
        stones: 10,
        answer: '',
    });

    const sortedMissions = useMemo(() => {
        return [...specialMissions].sort((a, b) => b.stars - a.stars || a.content.localeCompare(b.content));
    }, [specialMissions]);

    const ensureStarGroupsMap = (): { [stars: number]: string[] } => {
        const existing = generalSettings.specialMissionStarGroups || {};
        const next: { [stars: number]: string[] } = {};
        for (const star of STAR_LEVELS) {
            const cur = existing[star];
            next[star] = cur && cur.length > 0 ? [...cur] : [MISSION_ALL_GROUPS];
        }
        return next;
    };

    const getStarGroups = (stars: number): string[] => {
        const cur = generalSettings.specialMissionStarGroups?.[stars];
        if (cur && cur.length > 0) return cur;
        return [MISSION_ALL_GROUPS];
    };

    const setStarGroups = (stars: number, nextRaw: string[]) => {
        const map = ensureStarGroupsMap();
        map[stars] = normalizeGroupSelection(nextRaw, groupOrder);
        onUpdateGeneralSettings({
            ...generalSettings,
            specialMissionStarGroups: map,
        });
    };

    if (!isOpen) return null;

    const resetForm = () => {
        setFormData({
            content: '',
            stars: 3,
            stones: 10,
            answer: '',
        });
        setIsAdding(false);
        setEditingMissionId(null);
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.content.trim()) return;
        const payload: SpecialMission = {
            ...formData,
            content: formData.content.trim(),
            visibleGroups: [MISSION_ALL_GROUPS],
            group: undefined,
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

    const renderStarGroupPickers = (stars: number) => {
        const value = getStarGroups(stars);
        const isAll = value.includes(MISSION_ALL_GROUPS);
        return (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontWeight: 600 }}>
                    <input
                        type="checkbox"
                        checked={isAll}
                        onChange={e => setStarGroups(
                            stars,
                            e.target.checked ? [MISSION_ALL_GROUPS] : (groupOrder[0] ? [groupOrder[0]] : [MISSION_ALL_GROUPS])
                        )}
                    />
                    공동(전체)
                </label>
                {groupOrder.map(gk => (
                    <label key={gk} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={!isAll && value.includes(gk)}
                            onChange={() => {
                                if (isAll) {
                                    setStarGroups(stars, [gk]);
                                    return;
                                }
                                const has = value.includes(gk);
                                const next = has ? value.filter(x => x !== gk) : [...value, gk];
                                setStarGroups(stars, next);
                            }}
                        />
                        {groupSettings[gk]?.name || gk}
                    </label>
                ))}
            </div>
        );
    };

    const starGroupSummary = (stars: number) => {
        if (!generalSettings.specialMissionStarGroups) return '출현 설정에서 지정';
        const value = getStarGroups(stars);
        if (value.includes(MISSION_ALL_GROUPS)) return '전체 반';
        return value.map(g => groupSettings[g]?.name || g).join(', ') || '없음';
    };

    return (
        <ModalShell
            title="특별 미션 관리"
            size="xl"
            onClose={onClose}
            footer={<button type="button" className="btn primary" onClick={onClose}>닫기</button>}
        >
            <div className="sidebar-tabs" style={{ marginBottom: '1.5rem' }}>
                <button type="button" className={`tab-item ${activeTab === 'list' ? 'active' : ''}`} onClick={() => setActiveTab('list')}>미션 목록</button>
                <button type="button" className={`tab-item ${activeTab === 'appearance' ? 'active' : ''}`} onClick={() => setActiveTab('appearance')}>출현 설정</button>
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
                            <p className="form-note">
                                노출 반은 <strong>출현 설정</strong> 탭에서 별 개수별로 지정합니다.
                                {generalSettings.specialMissionStarGroups
                                    ? ` (현재 ★${formData.stars}: ${starGroupSummary(formData.stars)})`
                                    : ' (아직 설정 전이면 기존 미션별 노출 규칙을 사용합니다)'}
                            </p>
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
                        {sortedMissions.map(m => (
                            <div key={m.id} className="item-card" style={{ padding: '1rem', marginBottom: '0.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                                    <div style={{ flex: '1 1 220px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
                                            <p style={{ fontWeight: 'bold', margin: 0 }}>{m.content}</p>
                                        </div>
                                        {m.answer && (
                                            <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', fontStyle: 'italic', margin: '0 0 0.3rem 0' }}>
                                                답: {m.answer}
                                            </p>
                                        )}
                                        <p style={{ fontSize: '0.9rem', color: 'var(--accent-color)', margin: 0 }}>
                                            {'★'.repeat(m.stars)}{' '}
                                            <span style={{ color: 'var(--color-muted)', marginLeft: '0.5rem' }}>{m.stones} 스톤</span>
                                            <span style={{ color: 'var(--color-muted)', marginLeft: '0.75rem', fontSize: '0.82rem' }}>
                                                노출: {starGroupSummary(m.stars)}
                                            </span>
                                        </p>
                                    </div>
                                    <div className="item-actions" style={{ display: 'flex', gap: '0.35rem', alignItems: 'flex-start' }}>
                                        <button type="button" className="btn-sm" onClick={() => handleEdit(m)}>수정</button>
                                        <button type="button" className="btn-sm danger" onClick={() => handleDelete(m.id)}>삭제</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {sortedMissions.length === 0 && !isAdding && (
                            <p style={{ textAlign: 'center', color: 'var(--color-muted)', padding: '2rem' }}>등록된 특별 미션이 없습니다.</p>
                        )}
                    </div>
                </>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="settings-card">
                        <h4>별 개수별 반 노출</h4>
                        <p className="form-note">
                            난이도(★)마다 어떤 반에 미션이 나올지 정합니다. 체크되지 않은 반에는 해당 별 미션이 배정되지 않습니다.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                            {STAR_LEVELS.map(starCount => (
                                <div key={starCount} className="ui-panel-muted" style={{ padding: '0.9rem 1.1rem' }}>
                                    <div style={{ fontWeight: 'bold', color: 'var(--accent-color)', marginBottom: '0.65rem' }}>
                                        {'★'.repeat(starCount)}
                                        <span style={{ fontWeight: 'normal', color: 'var(--color-muted)', marginLeft: '0.5rem', fontSize: '0.85rem' }}>
                                            ({starCount}개)
                                        </span>
                                    </div>
                                    {renderStarGroupPickers(starCount)}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="settings-card">
                        <h4>반별 출현 확률</h4>
                        <div className="view-toggle" style={{ marginBottom: '1.25rem' }}>
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

                        <p className="form-note">
                            {groupSettings[activeGroup]?.name || activeGroup}반: ★5 → ★2 순으로 각 난이도별 확률(%)을 적용해 시도합니다.
                            해당 별이 이 반에 노출되지 않거나 풀에 미션이 없으면 건너뜁니다.
                            모두 통과하지 못하면, 노출 가능한 미션 중 <strong>가장 낮은 별</strong>에서 반드시 하나가 선택됩니다.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {STAR_LEVELS.map(starCount => {
                                const exposed = getStarGroups(starCount);
                                const visibleHere = exposed.includes(MISSION_ALL_GROUPS) || exposed.includes(activeGroup);
                                return (
                                    <div
                                        key={starCount}
                                        className="ui-panel-muted"
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '1.5rem',
                                            opacity: visibleHere ? 1 : 0.55,
                                        }}
                                    >
                                        <div style={{ width: '120px', fontWeight: 'bold', color: 'var(--accent-color)' }}>
                                            {'★'.repeat(starCount)}
                                            {starCount === 1 && (
                                                <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 'normal', display: 'block' }}>
                                                    (최종 보장)
                                                </span>
                                            )}
                                            {!visibleHere && (
                                                <span style={{ fontSize: '0.72rem', color: 'var(--danger-color)', fontWeight: 'normal', display: 'block' }}>
                                                    이 반 비노출
                                                </span>
                                            )}
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
                                                    style={{ width: '100%', padding: '4px', textAlign: 'center', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                                                    disabled={starCount === 1}
                                                />
                                            </div>
                                            <span style={{ fontWeight: 'bold' }}>%</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="ui-inline-note">
                            <p>
                                ★1 구간은 “모든 시도가 실패했을 때” 선택되는 <strong>최종 안전망</strong>이라 확률 입력은 비활성화되어 있습니다.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </ModalShell>
    );
};
