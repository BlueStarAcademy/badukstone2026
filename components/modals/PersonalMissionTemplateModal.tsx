import React, { useMemo, useState } from 'react';
import type { GroupSettings, PersonalMissionTemplate, PersonalMissionType } from '../../types';
import { generateId } from '../../utils';
import { MISSION_ALL_GROUPS } from '../../utils/missionVisibility';
import { ModalShell } from '../ui/ModalShell';

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
            <div className="pm-group-picker">
                <label className={isAll ? 'selected' : ''}>
                    <input
                        type="checkbox"
                        checked={isAll}
                        onChange={e => onChange(e.target.checked ? [MISSION_ALL_GROUPS] : (groupOrder[0] ? [groupOrder[0]] : [MISSION_ALL_GROUPS]))}
                    />
                    <span>전체 학생</span>
                </label>
                {groupOrder.map(gk => (
                    <label key={gk} className={!isAll && value.includes(gk) ? 'selected' : ''}>
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
                        <span>{groupSettings[gk]?.name || gk}</span>
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
        <ModalShell
            title="공통 개인미션 관리"
            description="공통 설정은 모든 대상 학생에게 반영되고, 학생별 현재 진행 번호는 그대로 유지됩니다."
            icon="◇"
            size="lg"
            onClose={onClose}
            className="personal-mission-admin-modal pm-template-modal"
            footer={
                <>
                    <span className="pm-action-summary">학생이 삭제한 공통 미션은 자동으로 다시 추가되지 않습니다.</span>
                    <button type="button" className="btn" onClick={onClose}>완료</button>
                </>
            }
        >
                <div className="pm-template-body">
                    <div className="pm-template-toolbar">
                        <div>
                            <strong>등록된 공통 미션</strong>
                            <span>{templates.length}개</span>
                        </div>
                        {!isAdding && (
                            <button type="button" className="btn primary" onClick={() => { setIsAdding(true); setForm(defaultForm()); }}>
                                + 새 공통 미션
                            </button>
                        )}
                    </div>

                    {isAdding && (
                        <form onSubmit={handleSave} className="pm-template-form">
                            <div className="pm-section-heading">
                                <span className="pm-step">{editingId ? '✎' : '+'}</span>
                                <div>
                                    <h3>{editingId ? '공통 미션 수정' : '새 공통 미션'}</h3>
                                    <p>대상 학생에게 자동으로 표시될 기본 정보를 설정합니다.</p>
                                </div>
                            </div>

                            <div className="pm-choice-grid" role="radiogroup" aria-label="미션 방식">
                                {(['continuous', 'weekly', 'monthly', 'achievement'] as const).map(mt => (
                                    <label key={mt} className={missionType === mt ? 'selected' : ''}>
                                        <input
                                            type="radio"
                                            name="template-mission-type"
                                            checked={missionType === mt}
                                            onChange={() => setForm(f => ({ ...f, missionType: mt, no: mt === 'continuous' ? (f.no || 1) : 0 }))}
                                        />
                                        <span>{mt === 'continuous' ? '연속' : mt === 'weekly' ? '주간' : mt === 'monthly' ? '월간' : '업적'}</span>
                                    </label>
                                ))}
                            </div>

                            <div className="pm-field-grid">
                                <div className="form-group pm-title-field">
                                    <label htmlFor="pmt-title">미션 내용</label>
                                    <input
                                        id="pmt-title"
                                        type="text"
                                        value={form.title}
                                        onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                                        placeholder="예: 정석 외우기"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="pmt-stones">보상 점수</label>
                                    <div className="pm-number-field">
                                        <input
                                            id="pmt-stones"
                                            type="number"
                                            min={0}
                                            value={form.stones}
                                            onChange={e => setForm(f => ({ ...f, stones: parseInt(e.target.value, 10) || 0 }))}
                                        />
                                        <span>점</span>
                                    </div>
                                </div>
                                {missionType === 'continuous' && (
                                    <div className="form-group">
                                        <label htmlFor="pmt-no">신규 시작 번호</label>
                                        <div className="pm-number-field">
                                            <span>No.</span>
                                            <input
                                                id="pmt-no"
                                                type="number"
                                                min={1}
                                                value={form.no}
                                                onChange={e => setForm(f => ({ ...f, no: parseInt(e.target.value, 10) || 1 }))}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="form-group pm-target-group">
                                <div className="pm-label-with-help">
                                    <label>부여 대상</label>
                                    <small>전체 학생 또는 여러 반을 선택할 수 있습니다.</small>
                                </div>
                                {renderGroupPickers(form.targetGroups || [MISSION_ALL_GROUPS], next => setForm(f => ({ ...f, targetGroups: next })))}
                            </div>

                            <div className="pm-inline-actions">
                                <button type="button" className="btn" onClick={resetForm}>취소</button>
                                <button type="submit" className="btn primary">{editingId ? '변경사항 저장' : '공통 미션 추가'}</button>
                            </div>
                        </form>
                    )}

                    <div className="pm-template-list">
                        {sorted.length === 0 ? (
                            <div className="pm-template-empty">
                                <span aria-hidden="true">◇</span>
                                <strong>등록된 공통 미션이 없습니다.</strong>
                                <p>새 공통 미션을 만들면 선택한 학생들에게 자동으로 추가됩니다.</p>
                            </div>
                        ) : sorted.map(t => {
                            const mt = t.missionType || 'continuous';
                            const typeLabel = mt === 'weekly' ? '주간' : mt === 'monthly' ? '월간' : mt === 'achievement' ? '업적' : `연속 · 시작 No.${t.no}`;
                            const groupLabel = !t.targetGroups || t.targetGroups.includes(MISSION_ALL_GROUPS)
                                ? '전체 학생'
                                : (t.targetGroups.map(g => groupSettings[g]?.name || g).join(', '));
                            return (
                                <article key={t.id} className="pm-template-card">
                                    <div className="pm-template-card-main">
                                        <div className="pm-template-card-meta">
                                            <span className={`pm-type-badge ${mt}`}>{typeLabel}</span>
                                            <span className="pm-group-badge">{groupLabel}</span>
                                        </div>
                                        <strong>{t.title}</strong>
                                        <span className="pm-reward">+{t.stones}점</span>
                                    </div>
                                    <div className="pm-template-card-actions">
                                        <button type="button" className="btn-sm" onClick={() => startEdit(t)}>수정</button>
                                        <button
                                            type="button"
                                            className="btn-sm danger"
                                            onClick={() => confirm(`"${t.title}" 템플릿을 삭제할까요? 학생 카드에서도 제거됩니다.`) && onDelete(t.id)}
                                        >
                                            삭제
                                        </button>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </div>
        </ModalShell>
    );
};
