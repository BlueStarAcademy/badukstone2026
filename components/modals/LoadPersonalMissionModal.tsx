import React, { useState } from 'react';
import type { Student, PersonalMissionsByStudent } from '../../types';

interface LoadPersonalMissionModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentStudentId: string;
    students: Student[];
    personalMissions: PersonalMissionsByStudent;
    onLoad: (missions: { title: string; stones: number; no: number }[]) => void;
}

export const LoadPersonalMissionModal = ({
    isOpen,
    onClose,
    currentStudentId,
    students,
    personalMissions,
    onLoad
}: LoadPersonalMissionModalProps) => {
    if (!isOpen) return null;

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const loadableList = students.flatMap(s => {
        if (s.id === currentStudentId) return [];
        const list = personalMissions[s.id] || [];
        return list.map(m => ({ student: s, mission: m }));
    });

    const toggleId = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
                <h2>개인 미션 불러오기</h2>
                <p className="modal-description" style={{ fontSize: '0.9rem', color: 'var(--text-color-secondary)', marginBottom: '1rem' }}>
                    다른 학생에게 저장된 개인 연속 미션을 선택하여 한 번에 불러올 수 있습니다.
                </p>
                <div className="load-mission-list">
                    {loadableList.length === 0 ? (
                        <p style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-color-secondary)' }}>
                            불러올 수 있는 개인 미션이 없습니다.
                            <br />
                            <small>다른 학생에게 먼저 개인 미션을 저장해 주세요.</small>
                        </p>
                    ) : (
                        <ul className="load-mission-list-ul">
                            {loadableList.map(({ student, mission }) => (
                                <li key={mission.id} className="load-mission-list-item">
                                    <div className="load-mission-info">
                                        <span className="load-mission-student-name">{student.name}</span>
                                        <span className="load-mission-series-desc">
                                            No.{mission.no} · {mission.title} · +{mission.stones}
                                        </span>
                                    </div>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(mission.id)}
                                            onChange={() => toggleId(mission.id)}
                                        />
                                        <span style={{ fontSize: '0.8rem' }}>선택</span>
                                    </label>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <div className="modal-actions" style={{ marginTop: '1rem', justifyContent: 'flex-end' }}>
                    <button
                        type="button"
                        className="btn primary"
                        disabled={selectedIds.size === 0}
                        onClick={() => {
                            const missionsToLoad = loadableList
                                .filter(({ mission }) => selectedIds.has(mission.id))
                                .map(({ mission }) => ({
                                    title: mission.title,
                                    stones: mission.stones,
                                    no: mission.no,
                                }));
                            onLoad(missionsToLoad);
                            onClose();
                        }}
                    >
                        선택한 미션 불러오기
                    </button>
                    <button type="button" className="btn" onClick={onClose}>닫기</button>
                </div>
            </div>
        </div>
    );
};
