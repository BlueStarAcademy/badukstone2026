import React, { useEffect, useMemo, useState } from 'react';
import type { GroupSettings, PersonalMissionType, Student } from '../../types';

interface AssignPersonalMissionModalProps {
    isOpen: boolean;
    onClose: () => void;
    students: Student[];
    groupSettings: GroupSettings;
    groupOrder: string[];
    initialStudentIds?: string[];
    onAssign: (
        studentIds: string[],
        mission: { title: string; stones: number; no: number; missionType: PersonalMissionType }
    ) => void;
}

const typeLabels: Record<PersonalMissionType, string> = {
    continuous: '연속',
    weekly: '주간',
    monthly: '월간',
    achievement: '업적',
};

export const AssignPersonalMissionModal = ({
    isOpen,
    onClose,
    students,
    groupSettings,
    groupOrder,
    initialStudentIds = [],
    onAssign,
}: AssignPersonalMissionModalProps) => {
    const [title, setTitle] = useState('');
    const [stones, setStones] = useState(10);
    const [no, setNo] = useState(1);
    const [missionType, setMissionType] = useState<PersonalMissionType>('continuous');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [activeGroup, setActiveGroup] = useState('전체');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        const validIds = new Set(students.map(student => student.id));
        setTitle('');
        setStones(10);
        setNo(1);
        setMissionType('continuous');
        setSelectedIds(new Set(initialStudentIds.filter(id => validIds.has(id))));
        setActiveGroup('전체');
        setSearchTerm('');
    }, [isOpen, initialStudentIds, students]);

    const filteredStudents = useMemo(() => {
        const query = searchTerm.trim().toLocaleLowerCase('ko');
        return students
            .filter(student => activeGroup === '전체' || student.group === activeGroup)
            .filter(student => !query || student.name.toLocaleLowerCase('ko').includes(query))
            .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    }, [activeGroup, searchTerm, students]);

    if (!isOpen) return null;

    const allFilteredSelected = filteredStudents.length > 0
        && filteredStudents.every(student => selectedIds.has(student.id));

    const toggleStudent = (studentId: string) => {
        setSelectedIds(current => {
            const next = new Set(current);
            if (next.has(studentId)) next.delete(studentId);
            else next.add(studentId);
            return next;
        });
    };

    const toggleFilteredStudents = () => {
        setSelectedIds(current => {
            const next = new Set(current);
            if (allFilteredSelected) {
                filteredStudents.forEach(student => next.delete(student.id));
            } else {
                filteredStudents.forEach(student => next.add(student.id));
            }
            return next;
        });
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        const trimmedTitle = title.trim();
        if (!trimmedTitle || selectedIds.size === 0) return;
        onAssign(Array.from(selectedIds), {
            title: trimmedTitle,
            stones: Math.max(0, stones),
            no: missionType === 'continuous' ? Math.max(1, no) : 0,
            missionType,
        });
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content personal-mission-admin-modal assign-personal-mission-modal" onClick={event => event.stopPropagation()}>
                <header className="pm-modal-header">
                    <div className="pm-modal-icon" aria-hidden="true">◎</div>
                    <div>
                        <h2>학생별 개인미션 부여</h2>
                        <p>여러 학생에게 같은 미션을 한 번에 추가하고, 부여 후에는 학생별로 진행을 관리합니다.</p>
                    </div>
                    <button type="button" className="pm-modal-close" onClick={onClose} aria-label="닫기">×</button>
                </header>

                <form className="pm-modal-form" onSubmit={handleSubmit}>
                    <div className="pm-modal-scroll">
                        <section className="pm-section">
                            <div className="pm-section-heading">
                                <span className="pm-step">1</span>
                                <div>
                                    <h3>미션 설정</h3>
                                    <p>내용과 보상, 반복 방식을 설정하세요.</p>
                                </div>
                            </div>

                            <div className="pm-choice-grid" role="radiogroup" aria-label="미션 방식">
                                {(Object.keys(typeLabels) as PersonalMissionType[]).map(type => (
                                    <label key={type} className={missionType === type ? 'selected' : ''}>
                                        <input
                                            type="radio"
                                            name="assign-personal-type"
                                            checked={missionType === type}
                                            onChange={() => setMissionType(type)}
                                        />
                                        <span>{typeLabels[type]}</span>
                                        <small>
                                            {type === 'continuous' ? '완료할 때마다 번호 증가' :
                                                type === 'weekly' ? '매주 다시 완료 가능' :
                                                    type === 'monthly' ? '매월 다시 완료 가능' : '한 번만 완료'}
                                        </small>
                                    </label>
                                ))}
                            </div>

                            <div className="pm-field-grid">
                                <div className="form-group pm-title-field">
                                    <label htmlFor="assign-personal-title">미션 내용</label>
                                    <input
                                        id="assign-personal-title"
                                        type="text"
                                        value={title}
                                        onChange={event => setTitle(event.target.value)}
                                        placeholder="예: 정석 외우기"
                                        required
                                        autoFocus
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="assign-personal-stones">보상 점수</label>
                                    <div className="pm-number-field">
                                        <input
                                            id="assign-personal-stones"
                                            type="number"
                                            min={0}
                                            value={stones}
                                            onChange={event => setStones(parseInt(event.target.value, 10) || 0)}
                                        />
                                        <span>점</span>
                                    </div>
                                </div>
                                {missionType === 'continuous' && (
                                    <div className="form-group">
                                        <label htmlFor="assign-personal-no">시작 번호</label>
                                        <div className="pm-number-field">
                                            <span>No.</span>
                                            <input
                                                id="assign-personal-no"
                                                type="number"
                                                min={1}
                                                value={no}
                                                onChange={event => setNo(parseInt(event.target.value, 10) || 1)}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>

                        <section className="pm-section">
                            <div className="pm-section-heading">
                                <span className="pm-step">2</span>
                                <div>
                                    <h3>부여 대상 선택</h3>
                                    <p>반과 이름으로 빠르게 찾을 수 있습니다.</p>
                                </div>
                                <strong className="pm-selection-count">{selectedIds.size}명 선택</strong>
                            </div>

                            <div className="assign-personal-student-picker">
                                <div className="assign-personal-student-filters">
                                    <select aria-label="반 필터" value={activeGroup} onChange={event => setActiveGroup(event.target.value)}>
                                        <option value="전체">전체 반</option>
                                        {groupOrder.map(group => (
                                            <option key={group} value={group}>{groupSettings[group]?.name || group}</option>
                                        ))}
                                    </select>
                                    <input
                                        type="search"
                                        value={searchTerm}
                                        onChange={event => setSearchTerm(event.target.value)}
                                        placeholder="학생 이름 검색"
                                        aria-label="학생 이름 검색"
                                    />
                                    <button type="button" className="btn-sm pm-select-all" onClick={toggleFilteredStudents} disabled={filteredStudents.length === 0}>
                                        {allFilteredSelected ? '현재 목록 선택 해제' : '현재 목록 전체 선택'}
                                    </button>
                                </div>
                                <div className="assign-personal-student-list">
                                    {filteredStudents.length === 0 ? (
                                        <p>조건에 맞는 학생이 없습니다.</p>
                                    ) : filteredStudents.map(student => (
                                        <label key={student.id} className={`assign-personal-student-item ${selectedIds.has(student.id) ? 'selected' : ''}`}>
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(student.id)}
                                                onChange={() => toggleStudent(student.id)}
                                            />
                                            <span>{student.name}</span>
                                            <small>{groupSettings[student.group]?.name || student.group} · {student.status}</small>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </section>
                    </div>

                    <div className="modal-actions pm-modal-actions">
                        <span className="pm-action-summary">
                            {selectedIds.size > 0 ? `${selectedIds.size}명에게 미션을 추가합니다.` : '부여할 학생을 선택하세요.'}
                        </span>
                        <button type="button" className="btn" onClick={onClose}>취소</button>
                        <button type="submit" className="btn primary" disabled={!title.trim() || selectedIds.size === 0}>
                            미션 부여
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
