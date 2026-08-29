import React, { useMemo, useState } from 'react';
import type { GroupSettings, PersonalMissionsByStudent } from '../../types';
import type { PersonalMission } from '../../types';
import { MISSION_ALL_GROUPS, personalMissionAppliesToGroup, targetGroupsKey } from '../../utils/missionVisibility';
import { ModalShell } from '../ui/ModalShell';

interface LoadPersonalMissionModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentStudentId: string;
    students: { id: string; group: string }[];
    groupOrder: string[];
    groupSettings: GroupSettings;
    personalMissions: PersonalMissionsByStudent;
    onAddPersonalMission: (studentId: string, mission: { title: string; stones: number; no: number; missionType?: 'continuous' | 'weekly' | 'monthly' | 'achievement'; targetGroups?: string[] }) => void;
    onUpdatePersonalMission: (studentId: string, missionId: string, payload: { title?: string; stones?: number; no?: number; missionType?: 'continuous' | 'weekly' | 'monthly' | 'achievement'; targetGroups?: string[] }) => void;
    onDeletePersonalMission: (studentId: string, missionId: string) => void;
}

type MissionType = 'continuous' | 'weekly' | 'monthly' | 'achievement';

const MISSION_TYPE_LABELS: Record<MissionType, string> = {
    continuous: '연속 미션',
    weekly: '주간 미션',
    monthly: '월간 미션',
    achievement: '업적 미션',
};

function contentKey(m: PersonalMission): string {
    const tid = m.templateId || '';
    return `${m.title}|${m.missionType || 'continuous'}|${m.stones}|${m.no}|${tid}|${targetGroupsKey(m.targetGroups)}`;
}

export const LoadPersonalMissionModal = ({
    isOpen,
    onClose,
    currentStudentId,
    students,
    groupOrder,
    groupSettings,
    personalMissions,
    onAddPersonalMission,
    onUpdatePersonalMission,
    onDeletePersonalMission
}: LoadPersonalMissionModalProps) => {
    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
    const [applyToAllStudents, setApplyToAllStudents] = useState(false);
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [editStones, setEditStones] = useState('');
    const [editNo, setEditNo] = useState('');
    const [editType, setEditType] = useState<MissionType>('continuous');
    const [showAddForm, setShowAddForm] = useState(false);
    const [addTitle, setAddTitle] = useState('');
    const [addStones, setAddStones] = useState('');
    const [addNo, setAddNo] = useState('1');
    const [addType, setAddType] = useState<MissionType>('continuous');
    const [addTargetGroups, setAddTargetGroups] = useState<string[]>([MISSION_ALL_GROUPS]);
    const [editTargetGroups, setEditTargetGroups] = useState<string[]>([MISSION_ALL_GROUPS]);

    const currentStudentGroup = useMemo(
        () => students.find(s => s.id === currentStudentId)?.group ?? '',
        [students, currentStudentId]
    );

    const uniqueMissions = useMemo(() => {
        const byKey = new Map<string, { mission: PersonalMission; instances: { studentId: string; missionId: string }[] }>();
        students.forEach(s => {
            const list = personalMissions[s.id] || [];
            list.forEach(m => {
                const key = contentKey(m);
                const existing = byKey.get(key);
                if (!existing) {
                    byKey.set(key, { mission: m, instances: [{ studentId: s.id, missionId: m.id }] });
                } else {
                    existing.instances.push({ studentId: s.id, missionId: m.id });
                }
            });
        });
        return Array.from(byKey.entries()).map(([key, { mission, instances }]) => ({ key, mission, instances }));
    }, [students, personalMissions]);

    const visibleUniqueMissions = useMemo(
        () => uniqueMissions.filter(({ mission }) => personalMissionAppliesToGroup(mission.targetGroups, currentStudentGroup)),
        [uniqueMissions, currentStudentGroup]
    );

    const selectAllByType = (mode: 'all' | MissionType) => {
        setSelectedKeys(() => {
            if (mode === 'all') {
                return new Set(visibleUniqueMissions.map(m => m.key));
            }
            const next = new Set<string>();
            visibleUniqueMissions.forEach(({ key, mission }) => {
                const t: MissionType = (mission.missionType as MissionType) || 'continuous';
                if (t === mode) next.add(key);
            });
            return next;
        });
    };

    const renderTargetGroupPickers = (value: string[], onChange: (next: string[]) => void) => {
        const isAll = value.includes(MISSION_ALL_GROUPS);
        return (
            <div className="load-mission-edit-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <label>노출 반</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem 0.75rem', alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', fontWeight: 600 }}>
                        <input
                            type="checkbox"
                            checked={isAll}
                            onChange={e => onChange(e.target.checked ? [MISSION_ALL_GROUPS] : (groupOrder[0] ? [groupOrder[0]] : [MISSION_ALL_GROUPS]))}
                        />
                        공동(전체)
                    </label>
                    {groupOrder.map(gk => (
                        <label key={gk} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', fontSize: '0.85rem' }}>
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
            </div>
        );
    };

    const toggleKey = (key: string) => {
        setSelectedKeys(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const startEdit = (key: string, mission: PersonalMission) => {
        setEditingKey(key);
        setEditTitle(mission.title);
        setEditStones(String(mission.stones));
        setEditNo(String(mission.no));
        setEditType((mission.missionType as MissionType) || 'continuous');
        const tg = mission.targetGroups && mission.targetGroups.length > 0 ? [...mission.targetGroups] : [MISSION_ALL_GROUPS];
        setEditTargetGroups(tg.includes(MISSION_ALL_GROUPS) ? [MISSION_ALL_GROUPS] : tg);
    };

    const saveEdit = () => {
        if (!editingKey) return;
        const item = uniqueMissions.find(x => x.key === editingKey);
        if (!item) return;
        const stones = parseInt(editStones, 10);
        const no = editType === 'continuous' ? parseInt(editNo, 10) : 0;
        if (Number.isNaN(stones) || stones < 0) return;
        if (item.mission.templateId) {
            item.instances.forEach(({ studentId, missionId }) => {
                onUpdatePersonalMission(studentId, missionId, { stones });
            });
            setEditingKey(null);
            return;
        }
        if (!editTitle.trim()) return;
        if (editType === 'continuous' && (Number.isNaN(no) || no < 1)) return;
        const tg = editTargetGroups.includes(MISSION_ALL_GROUPS) ? [MISSION_ALL_GROUPS] : [...new Set(editTargetGroups)];
        const payload = {
            title: editTitle.trim(),
            stones,
            no,
            missionType: editType,
            targetGroups: tg.length ? tg : [MISSION_ALL_GROUPS],
        };
        item.instances.forEach(({ studentId, missionId }) => {
            onUpdatePersonalMission(studentId, missionId, payload);
        });
        setEditingKey(null);
    };

    const handleDelete = (key: string) => {
        const item = uniqueMissions.find(x => x.key === key);
        if (!item || !confirm(`"${item.mission.title}" 미션을 저장소에서 삭제하시겠습니까? (해당 미션을 가진 모든 학생에게서 삭제됩니다)`)) return;
        item.instances.forEach(({ studentId, missionId }) => {
            onDeletePersonalMission(studentId, missionId);
        });
        setSelectedKeys(prev => { const n = new Set(prev); n.delete(key); return n; });
    };

    const saveNewMission = () => {
        const title = addTitle.trim();
        const stones = parseInt(addStones, 10);
        const no = addType === 'continuous' ? parseInt(addNo, 10) : 0;
        if (!title || Number.isNaN(stones) || stones < 0) return;
        if (addType === 'continuous' && (Number.isNaN(no) || no < 1)) return;
        const tg = addTargetGroups.includes(MISSION_ALL_GROUPS) ? [MISSION_ALL_GROUPS] : [...new Set(addTargetGroups)];
        onAddPersonalMission(currentStudentId, {
            title,
            stones,
            no,
            missionType: addType,
            targetGroups: tg.length ? tg : [MISSION_ALL_GROUPS],
        });
        setAddTitle('');
        setAddStones('');
        setAddNo('1');
        setAddType('continuous');
        setAddTargetGroups([MISSION_ALL_GROUPS]);
        setShowAddForm(false);
    };

    if (!isOpen) return null;

    return (
        <ModalShell
            title="개인 미션 불러오기"
            size="lg"
            onClose={onClose}
            className="load-personal-mission-modal"
            footer={
                <>
                    <button type="button" className="btn" onClick={onClose}>닫기</button>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={applyToAllStudents}
                            onChange={(e) => setApplyToAllStudents(e.target.checked)}
                        />
                        모든 학생에게 추가
                    </label>
                    <button
                        type="button"
                        className="btn primary"
                        disabled={selectedKeys.size === 0}
                        onClick={() => {
                            const missionsToLoad = uniqueMissions
                                .filter(({ key }) => selectedKeys.has(key))
                                .map(({ mission }) => ({
                                    title: mission.title,
                                    stones: mission.stones,
                                    no: mission.no,
                                    missionType: mission.missionType || 'continuous',
                                    targetGroups: mission.targetGroups && mission.targetGroups.length > 0
                                        ? mission.targetGroups
                                        : [MISSION_ALL_GROUPS],
                                }));

                            const targetStudentIds = applyToAllStudents ? students.map(s => s.id) : [currentStudentId];

                            const hasSameMission = (existing: PersonalMission, incoming: { title: string; stones: number; no: number; missionType: MissionType; targetGroups: string[] }) => {
                                const existingType = (existing.missionType || 'continuous') as MissionType;
                                return (
                                    (existing.templateId || '') === '' &&
                                    existing.title === incoming.title &&
                                    existing.stones === incoming.stones &&
                                    existing.no === incoming.no &&
                                    existingType === incoming.missionType &&
                                    targetGroupsKey(existing.targetGroups) === targetGroupsKey(incoming.targetGroups)
                                );
                            };

                            targetStudentIds.forEach(targetId => {
                                const stu = students.find(s => s.id === targetId);
                                const g = stu?.group ?? '';
                                const existing = personalMissions[targetId] || [];
                                missionsToLoad.forEach(m => {
                                    if (!personalMissionAppliesToGroup(m.targetGroups, g)) return;
                                    const incoming = { ...m, missionType: (m.missionType || 'continuous') as MissionType };
                                    if (existing.some(ex => hasSameMission(ex, incoming))) return;
                                    onAddPersonalMission(targetId, incoming);
                                });
                            });

                            onClose();
                        }}
                    >
                        선택한 미션 {applyToAllStudents ? '모든 학생에게 추가' : '불러오기'} ({selectedKeys.size})
                    </button>
                </>
            }
        >
                    <p className="load-mission-modal-description">
                        저장된 개인 미션(연속/주간/월간/업적)을 선택하여 불러올 수 있습니다. 같은 내용의 미션은 하나만 표시됩니다.
                        그룹 기본으로 붙은 카드는 관리자 탭의 「그룹 기본 개인 미션」에서 수정하고, 여기서는 점수만 바꿀 수 있습니다.
                    </p>
                    {visibleUniqueMissions.length > 0 && (
                        <div className="load-mission-bulk-select-row">
                            <span className="load-mission-bulk-label">빠른 선택:</span>
                            <button
                                type="button"
                                className="btn btn-xs"
                                onClick={() => selectAllByType('all')}
                            >
                                전체 선택
                            </button>
                            <button
                                type="button"
                                className="btn btn-xs"
                                onClick={() => selectAllByType('continuous')}
                            >
                                연속 미션만
                            </button>
                            <button
                                type="button"
                                className="btn btn-xs"
                                onClick={() => selectAllByType('weekly')}
                            >
                                주간 미션만
                            </button>
                            <button
                                type="button"
                                className="btn btn-xs"
                                onClick={() => selectAllByType('monthly')}
                            >
                                월간 미션만
                            </button>
                            <button
                                type="button"
                                className="btn btn-xs"
                                onClick={() => selectAllByType('achievement')}
                            >
                                업적 미션만
                            </button>
                            <button
                                type="button"
                                className="btn btn-xs"
                                onClick={() => setSelectedKeys(new Set())}
                            >
                                선택 해제
                            </button>
                        </div>
                    )}
                    {!showAddForm ? (
                        <button type="button" className="btn btn-sm primary load-mission-add-btn" onClick={() => setShowAddForm(true)}>
                            + 새 미션 추가
                        </button>
                    ) : (
                        <div className="load-mission-edit-panel load-mission-add-panel">
                            <h4>새 미션 추가</h4>
                            <div className="load-mission-edit-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                                <label>방식</label>
                                <div className="ui-choice-grid" role="radiogroup" aria-label="미션 방식">
                                    {(Object.keys(MISSION_TYPE_LABELS) as MissionType[]).map(type => (
                                        <label key={type} className={addType === type ? 'selected' : ''}>
                                            <input
                                                type="radio"
                                                name="load-mission-add-type"
                                                checked={addType === type}
                                                onChange={() => setAddType(type)}
                                            />
                                            <span>{MISSION_TYPE_LABELS[type]}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="load-mission-edit-row">
                                <label>내용</label>
                                <input type="text" value={addTitle} onChange={e => setAddTitle(e.target.value)} placeholder="미션 내용" />
                            </div>
                            {addType === 'continuous' && (
                                <div className="load-mission-edit-row">
                                    <label>No.</label>
                                    <input type="number" value={addNo} onChange={e => setAddNo(e.target.value)} min={1} style={{ width: '80px' }} />
                                </div>
                            )}
                            <div className="load-mission-edit-row">
                                <label>점수</label>
                                <input type="number" value={addStones} onChange={e => setAddStones(e.target.value)} min={0} placeholder="0" style={{ width: '80px' }} />
                            </div>
                            {renderTargetGroupPickers(addTargetGroups, setAddTargetGroups)}
                            <div className="load-mission-edit-actions">
                                <button type="button" className="btn" onClick={() => { setShowAddForm(false); setAddTitle(''); setAddStones(''); setAddNo('1'); setAddTargetGroups([MISSION_ALL_GROUPS]); }}>취소</button>
                                <button type="button" className="btn primary" onClick={saveNewMission}>저장</button>
                            </div>
                        </div>
                    )}
                    {editingKey && (() => {
                        const item = uniqueMissions.find(x => x.key === editingKey);
                        if (!item) return null;
                        const fromTemplate = !!item.mission.templateId;
                        return (
                            <div className="load-mission-edit-panel">
                                <h4>미션 수정</h4>
                                {fromTemplate && (
                                    <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.75rem' }}>
                                        그룹 기본 미션입니다. 제목·유형·No·노출 반은 관리자 탭 「그룹 기본 개인 미션」에서 바꿀 수 있습니다.
                                    </p>
                                )}
                                {!fromTemplate && (
                                    <>
                                        <div className="load-mission-edit-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                                            <label>방식</label>
                                            <div className="ui-choice-grid" role="radiogroup" aria-label="미션 방식">
                                                {(Object.keys(MISSION_TYPE_LABELS) as MissionType[]).map(type => (
                                                    <label key={type} className={editType === type ? 'selected' : ''}>
                                                        <input
                                                            type="radio"
                                                            name="load-mission-edit-type"
                                                            checked={editType === type}
                                                            onChange={() => setEditType(type)}
                                                        />
                                                        <span>{MISSION_TYPE_LABELS[type]}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="load-mission-edit-row">
                                            <label>내용</label>
                                            <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="미션 내용" />
                                        </div>
                                        {editType === 'continuous' && (
                                            <div className="load-mission-edit-row">
                                                <label>No.</label>
                                                <input type="number" value={editNo} onChange={e => setEditNo(e.target.value)} min={1} style={{ width: '80px' }} />
                                            </div>
                                        )}
                                    </>
                                )}
                                <div className="load-mission-edit-row">
                                    <label>점수</label>
                                    <input type="number" value={editStones} onChange={e => setEditStones(e.target.value)} min={0} style={{ width: '80px' }} />
                                </div>
                                {!fromTemplate && renderTargetGroupPickers(editTargetGroups, setEditTargetGroups)}
                                <div className="load-mission-edit-actions">
                                    <button type="button" className="btn" onClick={() => setEditingKey(null)}>취소</button>
                                    <button type="button" className="btn primary" onClick={saveEdit}>저장</button>
                                </div>
                            </div>
                        );
                    })()}
                    <div className="load-mission-list-wrap">
                        {uniqueMissions.length === 0 ? (
                            <div className="load-mission-empty">
                                <p className="load-mission-empty-title">불러올 수 있는 개인 미션이 없습니다.</p>
                                <p className="load-mission-empty-hint">먼저 개인 미션을 추가해 저장해 두면 여기에서 불러올 수 있습니다.</p>
                            </div>
                        ) : visibleUniqueMissions.length === 0 ? (
                            <div className="load-mission-empty">
                                <p className="load-mission-empty-title">이 반에 맞는 저장 미션이 없습니다.</p>
                                <p className="load-mission-empty-hint">다른 반 전용으로만 설정된 미션은 목록에 나오지 않습니다.</p>
                            </div>
                        ) : (
                            <ul className="load-mission-list-ul">
                                {visibleUniqueMissions.map(({ key, mission }) => (
                                    <li key={key} className="load-mission-list-item">
                                        <div className="load-mission-info">
                                            <span className="load-mission-series-desc">
                                                {(mission.missionType || 'continuous') === 'achievement'
                                                    ? '업적'
                                                    : (mission.missionType || 'continuous') === 'weekly'
                                                        ? '주간'
                                                        : (mission.missionType || 'continuous') === 'monthly'
                                                            ? '월간'
                                                            : `No.${mission.no}`} · {mission.title} · +{mission.stones}
                                                {' '}
                                                <span style={{ fontSize: '0.78rem', color: '#888' }}>
                                                    {mission.templateId
                                                        ? '[그룹 기본]'
                                                        : (!mission.targetGroups || mission.targetGroups.includes(MISSION_ALL_GROUPS))
                                                            ? '[공동]'
                                                            : `[${mission.targetGroups!.map(g => groupSettings[g]?.name || g).join(', ')}]`}
                                                </span>
                                            </span>
                                        </div>
                                        <div className="load-mission-item-actions">
                                            <button type="button" className="btn-sm" onClick={() => startEdit(key, mission)} title="수정">수정</button>
                                            <button type="button" className="btn-sm danger" onClick={() => handleDelete(key)} title="삭제">삭제</button>
                                            <label className="load-mission-checkbox">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedKeys.has(key)}
                                                    onChange={() => toggleKey(key)}
                                                />
                                                <span>선택</span>
                                            </label>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
        </ModalShell>
    );
};
