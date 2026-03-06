import React, { useMemo, useState } from 'react';
import type { PersonalMissionsByStudent } from '../../types';
import type { PersonalMission } from '../../types';

interface LoadPersonalMissionModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentStudentId: string;
    students: { id: string }[];
    personalMissions: PersonalMissionsByStudent;
    onLoad: (missions: { title: string; stones: number; no: number; missionType?: 'continuous' | 'achievement' }[]) => void;
    onAddPersonalMission: (studentId: string, mission: { title: string; stones: number; no: number; missionType?: 'continuous' | 'achievement' }) => void;
    onUpdatePersonalMission: (studentId: string, missionId: string, payload: { title?: string; stones?: number; no?: number; missionType?: 'continuous' | 'achievement' }) => void;
    onDeletePersonalMission: (studentId: string, missionId: string) => void;
}

type MissionType = 'continuous' | 'achievement';

function contentKey(m: PersonalMission): string {
    return `${m.title}|${m.missionType || 'continuous'}|${m.stones}`;
}

export const LoadPersonalMissionModal = ({
    isOpen,
    onClose,
    currentStudentId,
    students,
    personalMissions,
    onLoad,
    onAddPersonalMission,
    onUpdatePersonalMission,
    onDeletePersonalMission
}: LoadPersonalMissionModalProps) => {
    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
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
    }, [currentStudentId, students, personalMissions]);

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
    };

    const saveEdit = () => {
        if (!editingKey) return;
        const item = uniqueMissions.find(x => x.key === editingKey);
        if (!item) return;
        const stones = parseInt(editStones, 10);
        const no = editType === 'continuous' ? parseInt(editNo, 10) : 0;
        if (!editTitle.trim() || Number.isNaN(stones) || stones < 0) return;
        if (editType === 'continuous' && (Number.isNaN(no) || no < 1)) return;
        const payload = { title: editTitle.trim(), stones, no, missionType: editType };
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
        onAddPersonalMission(currentStudentId, { title, stones, no, missionType: addType });
        setAddTitle('');
        setAddStones('');
        setAddNo('1');
        setAddType('continuous');
        setShowAddForm(false);
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content load-personal-mission-modal" onClick={e => e.stopPropagation()}>
                <h2>개인 미션 불러오기</h2>
                <div className="modal-body">
                    <p className="load-mission-modal-description">
                        저장된 개인 미션(연속/업적)을 선택하여 불러올 수 있습니다. 같은 내용의 미션은 하나만 표시됩니다.
                    </p>
                    {!showAddForm ? (
                        <button type="button" className="btn btn-sm primary load-mission-add-btn" onClick={() => setShowAddForm(true)}>
                            + 새 미션 추가
                        </button>
                    ) : (
                        <div className="load-mission-edit-panel load-mission-add-panel">
                            <h4>새 미션 추가</h4>
                            <div className="load-mission-edit-row">
                                <label>방식</label>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'nowrap' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                        <input type="radio" checked={addType === 'continuous'} onChange={() => setAddType('continuous')} />
                                        연속 미션
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                        <input type="radio" checked={addType === 'achievement'} onChange={() => setAddType('achievement')} />
                                        업적 미션
                                    </label>
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
                            <div className="load-mission-edit-actions">
                                <button type="button" className="btn" onClick={() => { setShowAddForm(false); setAddTitle(''); setAddStones(''); setAddNo('1'); }}>취소</button>
                                <button type="button" className="btn primary" onClick={saveNewMission}>저장</button>
                            </div>
                        </div>
                    )}
                    {editingKey && (() => {
                        const item = uniqueMissions.find(x => x.key === editingKey);
                        if (!item) return null;
                        return (
                            <div className="load-mission-edit-panel">
                                <h4>미션 수정</h4>
                                <div className="load-mission-edit-row">
                                    <label>방식</label>
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'nowrap' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                            <input type="radio" checked={editType === 'continuous'} onChange={() => setEditType('continuous')} />
                                            연속 미션
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                            <input type="radio" checked={editType === 'achievement'} onChange={() => setEditType('achievement')} />
                                            업적 미션
                                        </label>
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
                                <div className="load-mission-edit-row">
                                    <label>점수</label>
                                    <input type="number" value={editStones} onChange={e => setEditStones(e.target.value)} min={0} style={{ width: '80px' }} />
                                </div>
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
                        ) : (
                            <ul className="load-mission-list-ul">
                                {uniqueMissions.map(({ key, mission }) => (
                                    <li key={key} className="load-mission-list-item">
                                        <div className="load-mission-info">
                                            <span className="load-mission-series-desc">
                                                {(mission.missionType || 'continuous') === 'achievement' ? '업적' : `No.${mission.no}`} · {mission.title} · +{mission.stones}
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
                </div>
                <div className="modal-actions">
                    <button type="button" className="btn" onClick={onClose}>닫기</button>
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
                                }));
                            onLoad(missionsToLoad);
                            onClose();
                        }}
                    >
                        선택한 미션 불러오기 ({selectedKeys.size})
                    </button>
                </div>
            </div>
        </div>
    );
};
