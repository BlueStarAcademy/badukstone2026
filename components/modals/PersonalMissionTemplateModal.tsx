import React, { useMemo, useState } from 'react';
import type { GroupSettings, PersonalMissionTemplate, PersonalMissionType } from '../../types';
import { generateId } from '../../utils';
import { MISSION_ALL_GROUPS } from '../../utils/missionVisibility';

interface PersonalMissionTemplateModalProps {
    isOpen: boolean;
    onClose: () => void;
    templates: PersonalMissionTemplate[];
    onUpsert: (template: PersonalMissionTemplate) => void;
    onDelete: (templateId: string) => void;
    groupSettings: GroupSettings;
    groupOrder: string[];
}

type MissionType = PersonalMissionType;

const defaultForm = (): Omit<PersonalMissionTemplate, 'id'> => ({
    title: '',
    stones: 10,
    no: 1,
    missionType: 'continuous',
    targetGroups: [MISSION_ALL_GROUPS],
});

export const PersonalMissionTemplateModal = ({
    isOpen,
    onClose,
    templates,
    onUpsert,
    onDelete,
    groupSettings,
    groupOrder,
}: PersonalMissionTemplateModalProps) => {
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<Omit<PersonalMissionTemplate, 'id'>>(defaultForm);

    const sorted = useMemo(
        () => [...templates].sort((a, b) => a.title.localeCompare(b.title, 'ko')),
        [templates]
    );

    const resetForm = () => {
        setForm(defaultForm());
        setIsAdding(false);
        setEditingId(null);
    };

    const renderGroupPickers = (value: string[], onChange: (next: string[]) => void) => {
        const isAll = value.includes(MISSION_ALL_GROUPS);
        return (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', alignItems: 'center', marginTop: '0.35rem' }}>
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

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        const title = form.title.trim();
        if (!title) return;
        const stones = Math.max(0, form.stones);
        const mt: MissionType = form.missionType || 'continuous';
        const no = mt === 'continuous' ? Math.max(1, form.no || 1) : 0;
        const tg = form.targetGroups?.includes(MISSION_ALL_GROUPS)
            ? [MISSION_ALL_GROUPS]
            : (form.targetGroups && form.targetGroups.length > 0 ? [...new Set(form.targetGroups)] : [MISSION_ALL_GROUPS]);
        onUpsert({
            id: editingId || generateId(),
            title,
            stones,
            no,
            missionType: mt,
            targetGroups: tg,
        });
        resetForm();
    };

    const startEdit = (t: PersonalMissionTemplate) => {
        setEditingId(t.id);
        setForm({
            title: t.title,
            stones: t.stones,
            no: t.no,
            missionType: t.missionType || 'continuous',
            targetGroups: t.targetGroups?.length ? [...t.targetGroups] : [MISSION_ALL_GROUPS],
        });
        setIsAdding(true);
    };

    if (!isOpen) return null;

    const missionType = (form.missionType || 'continuous') as MissionType;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px', maxHeight: '90vh', overflow: 'auto' }}>
                <h2>그룹 기본 개인 미션</h2>
                <p style={{ fontSize: '0.88rem', color: 'var(--secondary-color)', marginTop: '-0.25rem' }}>
                    선택한 반(또는 공동)에 해당하는 학생에게 자동으로 개인 미션 카드가 붙습니다. 학생이 카드를 삭제하면 다시 붙이지 않습니다.
                    학생에게만 주는 미션은 빠른 메뉴에서 추가하세요.
                </p>

                {!isAdding ? (
                    <button type="button" className="btn btn-sm primary" style={{ marginBottom: '1rem' }} onClick={() => { setIsAdding(true); setForm(defaultForm()); }}>
                        + 템플릿 추가
                    </button>
                ) : (
                    <form onSubmit={handleSave} style={{ marginBottom: '1.25rem', padding: '1rem', background: 'var(--bg-color)', borderRadius: '8px' }}>
                        <h4 style={{ marginTop: 0 }}>{editingId ? '템플릿 수정' : '새 템플릿'}</h4>
                        <div className="form-group">
                            <label>방식</label>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                                {(['continuous', 'weekly', 'monthly', 'achievement'] as const).map(mt => (
                                    <label key={mt} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                                        <input
                                            type="radio"
                                            checked={missionType === mt}
                                            onChange={() => setForm(f => ({ ...f, missionType: mt, no: mt === 'continuous' ? (f.no || 1) : 0 }))}
                                        />
                                        {mt === 'continuous' ? '연속' : mt === 'weekly' ? '주간' : mt === 'monthly' ? '월간' : '업적'}
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="form-group">
                            <label htmlFor="pmt-title">내용</label>
                            <input
                                id="pmt-title"
                                type="text"
                                value={form.title}
                                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                                placeholder="미션 내용"
                                required
                            />
                        </div>
                        {missionType === 'continuous' && (
                            <div className="form-group">
                                <label htmlFor="pmt-no">시작 No.</label>
                                <input
                                    id="pmt-no"
                                    type="number"
                                    min={1}
                                    value={form.no}
                                    onChange={e => setForm(f => ({ ...f, no: parseInt(e.target.value, 10) || 1 }))}
                                    style={{ width: '88px' }}
                                />
                            </div>
                        )}
                        <div className="form-group">
                            <label htmlFor="pmt-stones">점수</label>
                            <input
                                id="pmt-stones"
                                type="number"
                                min={0}
                                value={form.stones}
                                onChange={e => setForm(f => ({ ...f, stones: parseInt(e.target.value, 10) || 0 }))}
                                style={{ width: '88px' }}
                            />
                        </div>
                        <div className="form-group">
                            <label>부여 대상 반</label>
                            {renderGroupPickers(form.targetGroups || [MISSION_ALL_GROUPS], next => setForm(f => ({ ...f, targetGroups: next })))}
                        </div>
                        <div className="modal-actions" style={{ marginTop: '1rem' }}>
                            <button type="button" className="btn" onClick={resetForm}>취소</button>
                            <button type="submit" className="btn primary">저장</button>
                        </div>
                    </form>
                )}

                <ul className="compact-item-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {sorted.length === 0 ? (
                        <li style={{ color: '#888', padding: '1rem' }}>등록된 그룹 기본 개인 미션이 없습니다.</li>
                    ) : (
                        sorted.map(t => {
                            const mt = t.missionType || 'continuous';
                            const typeLabel = mt === 'weekly' ? '주간' : mt === 'monthly' ? '월간' : mt === 'achievement' ? '업적' : `연속 No.${t.no}`;
                            const groupLabel = !t.targetGroups || t.targetGroups.includes(MISSION_ALL_GROUPS)
                                ? '공동'
                                : (t.targetGroups.map(g => groupSettings[g]?.name || g).join(', '));
                            return (
                                <li key={t.id} className="compact-item-row" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)' }}>
                                    <div className="item-main-info" style={{ flex: '1 1 200px' }}>
                                        <span className="item-desc">{typeLabel} · {t.title}</span>
                                        <span className="item-stones">+{t.stones}</span>
                                        <div style={{ fontSize: '0.78rem', color: '#888' }}>{groupLabel}</div>
                                    </div>
                                    <div className="item-row-actions">
                                        <button type="button" className="icon-btn" onClick={() => startEdit(t)}>✎</button>
                                        <button
                                            type="button"
                                            className="icon-btn danger"
                                            onClick={() => confirm(`"${t.title}" 템플릿을 삭제할까요? 학생 카드에서도 제거됩니다.`) && onDelete(t.id)}
                                        >
                                            ×
                                        </button>
                                    </div>
                                </li>
                            );
                        })
                    )}
                </ul>

                <div className="modal-actions" style={{ marginTop: '1rem' }}>
                    <button type="button" className="btn" onClick={onClose}>닫기</button>
                </div>
            </div>
        </div>
    );
};
