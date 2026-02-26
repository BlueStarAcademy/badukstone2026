
import React from 'react';
import type { Student } from '../types';

interface StudentCardProps {
    student: Student;
    activeCouponValue: number;
    groupName: string; // Used for border color class mapping only
    onClick: () => void;
    /** 이번 달 이벤트 참여 완료(스톤 수령 기록 있음) → 참여완료 뱃지만 표시 */
    hasParticipatedThisMonth: boolean;
    /** 이번 달 참여 가능(조건 충족 + 미참여) → 이벤트 버튼 */
    showThisMonthEventButton: boolean;
    /** 지난달 참여 조건 충족했으나 미참여 → 지난달 이벤트 버튼 */
    showLastMonthEventButton: boolean;
    onEventClick: () => void;
    onLastMonthEventClick: () => void;
}

const groupToClassMap: { [key: string]: string } = {
    '유단자': 'yudanja',
    '고급': 'gogeup',
    '중급': 'junggeup',
    '초급2': 'chogeup2',
    '초급1': 'chogeup1',
};


export const StudentCard: React.FC<StudentCardProps> = ({
    student, activeCouponValue, onClick,
    hasParticipatedThisMonth, showThisMonthEventButton, showLastMonthEventButton,
    onEventClick, onLastMonthEventClick
}) => {
    const groupClassName = groupToClassMap[student.group] || '';
    
    return (
        <div className={`student-card student-card--${groupClassName}`} onClick={onClick} role="button" tabIndex={0} onKeyPress={(e) => e.key === 'Enter' && onClick()}>
            <div className="student-card-header">
                <h3>
                    {student.name}
                    <span className="student-header-rank">{student.rank}</span>
                </h3>
                <div className="student-card-event-actions">
                    {/* 이번 달 참여 완료 시에만 참여완료 뱃지 표시 */}
                    {hasParticipatedThisMonth && (
                        <span className="event-badge success" title="이번 달 이벤트 참여 완료">참여완료</span>
                    )}
                    {/* 이번 달 참여 가능 → 이벤트 버튼 */}
                    {!hasParticipatedThisMonth && showThisMonthEventButton && (
                        <button
                            type="button"
                            className="btn-sm primary"
                            onClick={(e) => { e.stopPropagation(); onEventClick(); }}
                            title="이번 달 이벤트 참여"
                        >
                            이벤트
                        </button>
                    )}
                    {/* 지난달 조건 충족했으나 미참여 → 지난달 이벤트 버튼 (참여 후에는 버튼 사라짐) */}
                    {!hasParticipatedThisMonth && showLastMonthEventButton && (
                        <button
                            type="button"
                            className="btn-sm event-last-month"
                            onClick={(e) => { e.stopPropagation(); onLastMonthEventClick(); }}
                            title="지난달 이벤트 참여하기"
                        >
                            지난달 이벤트
                        </button>
                    )}
                </div>
            </div>
            
            <div className="student-card-bottom">
                <div className="student-card-stones">
                    <span className="current-stone-val">{student.stones}</span>
                    <span className="max-stone-separator">/</span>
                    <span className="max-stone-val">{student.maxStones}</span>
                </div>
                <span className="student-card-coupons">
                    {activeCouponValue > 0 ? (
                        <>
                            <span className="coupon-emoji">🎟️</span>
                            <span className="coupon-num">{activeCouponValue} 스톤</span>
                        </>
                    ) : '\u00A0'}
                </span>
            </div>
        </div>
    );
}
