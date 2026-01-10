
import React from 'react';
import type { Student } from '../types';

interface StudentCardProps {
    student: Student;
    activeCouponValue: number;
    groupName: string; // Used for border color class mapping only
    onClick: () => void;
    isEventEligible: boolean;
    hasParticipatedInEvent: boolean;
    onEventClick: () => void;
}

const groupToClassMap: { [key: string]: string } = {
    '유단자': 'yudanja',
    '고급': 'gogeup',
    '중급': 'junggeup',
    '초급2': 'chogeup2',
    '초급1': 'chogeup1',
};


export const StudentCard: React.FC<StudentCardProps> = ({ student, activeCouponValue, onClick, isEventEligible, hasParticipatedInEvent, onEventClick }) => {
    const groupClassName = groupToClassMap[student.group] || '';
    
    return (
        <div className={`student-card student-card--${groupClassName}`} onClick={onClick} role="button" tabIndex={0} onKeyPress={(e) => e.key === 'Enter' && onClick()}>
            <div className="student-card-header">
                <h3>
                    {student.name}
                    <span className="student-header-rank">{student.rank}</span>
                </h3>
                 {isEventEligible && (
                    <button className="btn-sm primary" onClick={(e) => { e.stopPropagation(); onEventClick(); }}>이벤트</button>
                )}
                {hasParticipatedInEvent && (
                    <span className="event-badge success" title="이번 달 이벤트 참여 완료">참여완료</span>
                )}
            </div>
            
            <div className="student-card-stones">
                <span className="current-stone-val">{student.stones}</span>
                <span className="max-stone-separator">/</span>
                <span className="max-stone-val">{student.maxStones}</span>
            </div>
            
            {activeCouponValue > 0 && (
                <p className="student-card-coupons">
                    🎟️ 쿠폰 {activeCouponValue} 스톤
                </p>
            )}
        </div>
    );
}
