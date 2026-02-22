
import React, { useState, useMemo } from 'react';
import type { Student, SortKey, Coupon, GroupSettings, GeneralSettings, Transaction, EventSettings, View } from '../types';
import { parseRank } from '../utils';
import { useDateKey } from '../hooks/useDateKey';
import { StudentCard } from './StudentCard';

interface StudentViewProps {
    students: Student[];
    coupons: Coupon[];
    onStudentClick: (student: Student) => void;
    onNavigateToEvent: (student: Student) => void;
    groupSettings: GroupSettings;
    generalSettings: GeneralSettings;
    transactions: Transaction[];
    eventSettings: EventSettings;
    setView: (view: View) => void;
}

export const StudentView = ({ students, coupons, onStudentClick, onNavigateToEvent, groupSettings, generalSettings, transactions, eventSettings, setView }: StudentViewProps) => {
    const [sortKey, setSortKey] = useState<SortKey>('rank');
    const [activeGroup, setActiveGroup] = useState('전체');
    const [searchTerm, setSearchTerm] = useState('');
    const dateKey = useDateKey();

    const { startOfMonth, endOfMonth, startOfPreviousMonth, endOfPreviousMonth, currentMonthIdentifier, previousMonthIdentifier } = useMemo(() => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        
        // Identifier format must match EventView (YYYY-M where M is 0-indexed)
        const currentMonthIdentifier = `${currentYear}-${currentMonth}`;

        const startOfMonth = new Date(currentYear, currentMonth, 1);
        const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);

        const previousMonthDate = new Date(currentYear, currentMonth - 1, 1);
        const previousYear = previousMonthDate.getFullYear();
        const previousMonth = previousMonthDate.getMonth();
        
        const previousMonthIdentifier = `${previousYear}-${previousMonth}`;

        const startOfPreviousMonth = new Date(previousYear, previousMonth, 1);
        const endOfPreviousMonth = new Date(previousYear, previousMonth + 1, 0, 23, 59, 59);
        
        return { startOfMonth, endOfMonth, startOfPreviousMonth, endOfPreviousMonth, currentMonthIdentifier, previousMonthIdentifier };
    }, [dateKey]);

    const eventParticipationStatus = useMemo(() => {
        const statusMap = new Map<string, {
            missionsThisMonth: number;
            penaltyCountThisMonth: number;
            hasParticipatedThisMonth: boolean;
            missionsLastMonth: number;
            penaltyCountLastMonth: number;
            hasParticipatedLastMonth: boolean;
        }>();

        students.forEach(student => {
            // Current Month Stats
            const missionsThisMonth = transactions.filter(t => 
                t.studentId === student.id &&
                (t.type === 'mission' || t.type === 'attendance' || t.type === 'special_mission' || t.type === 'mission_adjustment') &&
                new Date(t.timestamp) >= startOfMonth &&
                new Date(t.timestamp) <= endOfMonth &&
                t.status === 'active'
            ).reduce((acc, t) => {
                if (t.type === 'mission_adjustment') {
                    return acc + (t.missionCountDelta || 0);
                }
                return acc + 1;
            }, 0);

            const penaltyCountThisMonth = transactions.filter(t =>
                t.studentId === student.id &&
                t.type === 'penalty' &&
                new Date(t.timestamp) >= startOfMonth &&
                new Date(t.timestamp) <= endOfMonth &&
                t.status === 'active'
            ).length;
            
            const hasParticipatedThisMonth = transactions.some(t => {
                if (t.studentId !== student.id || (t.type !== 'roulette' && t.type !== 'gacha') || t.status === 'cancelled') {
                    return false;
                }
                if (t.eventMonth) {
                    return t.eventMonth === currentMonthIdentifier;
                }
                return new Date(t.timestamp) >= startOfMonth && new Date(t.timestamp) <= endOfMonth;
            });

            // Previous Month Stats
            const missionsLastMonth = transactions.filter(t =>
                t.studentId === student.id &&
                (t.type === 'mission' || t.type === 'attendance' || t.type === 'special_mission' || t.type === 'mission_adjustment') &&
                new Date(t.timestamp) >= startOfPreviousMonth &&
                new Date(t.timestamp) <= endOfPreviousMonth &&
                t.status === 'active'
            ).reduce((acc, t) => {
                if (t.type === 'mission_adjustment') {
                    return acc + (t.missionCountDelta || 0);
                }
                return acc + 1;
            }, 0);

            const penaltyCountLastMonth = transactions.filter(t =>
                t.studentId === student.id &&
                t.type === 'penalty' &&
                new Date(t.timestamp) >= startOfPreviousMonth &&
                new Date(t.timestamp) <= endOfPreviousMonth &&
                t.status === 'active'
            ).length;

            const hasParticipatedLastMonth = transactions.some(t => {
                 if (t.studentId !== student.id || (t.type !== 'roulette' && t.type !== 'gacha') || t.status === 'cancelled') {
                    return false;
                }
                if (t.eventMonth) {
                    return t.eventMonth === previousMonthIdentifier;
                }
                return new Date(t.timestamp) >= startOfPreviousMonth && new Date(t.timestamp) <= endOfPreviousMonth;
            });
            
            statusMap.set(student.id, {
                missionsThisMonth,
                penaltyCountThisMonth,
                hasParticipatedThisMonth,
                missionsLastMonth,
                penaltyCountLastMonth,
                hasParticipatedLastMonth,
            });
        });
        return statusMap;
    }, [students, transactions, startOfMonth, endOfMonth, startOfPreviousMonth, endOfPreviousMonth, currentMonthIdentifier, previousMonthIdentifier]);


    const sortedStudents = useMemo(() => {
        let activeStudents = students.filter(s => s.status === '재원');

        if (searchTerm.trim() !== '') {
            activeStudents = activeStudents.filter(s =>
                s.name.toLowerCase().includes(searchTerm.trim().toLowerCase())
            );
        }

        const filteredByGroup = activeGroup === '전체'
            ? activeStudents
            : activeStudents.filter(s => s.group === activeGroup);

        return [...filteredByGroup].sort((a, b) => {
            if (sortKey === 'name') return a.name.localeCompare(b.name);
            if (sortKey === 'stones') return b.stones - a.stones;
            if (sortKey === 'rank') return parseRank(b.rank) - parseRank(a.rank);
            return 0;
        });
    }, [students, sortKey, activeGroup, searchTerm]);

    const studentGroups = useMemo(() => ['전체', ...generalSettings.groupOrder.filter(g => groupSettings[g])], [generalSettings.groupOrder, groupSettings]);
    
    const activeCouponValueByStudent = useMemo(() => {
        const map = new Map<string, number>();
        coupons.forEach(coupon => {
            if (new Date(coupon.expiresAt) > new Date()) {
                map.set(coupon.studentId, (map.get(coupon.studentId) || 0) + coupon.value);
            }
        });
        return map;
    }, [coupons]);

    return (
        <div>
            <div className="controls">
                <div className="view-toggle">
                    {studentGroups.map(groupKey => (
                        <button
                            key={groupKey}
                            className={`toggle-btn ${activeGroup === groupKey ? 'active' : ''}`}
                            onClick={() => setActiveGroup(groupKey)}
                        >
                            {groupKey === '전체' ? '전체' : groupSettings[groupKey]?.name || groupKey}
                        </button>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <input
                        type="text"
                        placeholder="이름으로 검색..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="search-input"
                    />
                    <div className="sort-dropdown">
                        <label htmlFor="sort-order">정렬:</label>
                        <select id="sort-order" value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)}>
                            <option value="rank">급수순</option>
                            <option value="stones">스톤순</option>
                            <option value="name">이름순</option>
                        </select>
                    </div>
                </div>
            </div>
            <div className="student-grid">
                {sortedStudents.map(student => {
                    const stats = eventParticipationStatus.get(student.id);
                    if (!stats) return null;
                    
                    const minReq = eventSettings.minMissionsToSpin ?? 10;
                    const maxPenalties = eventSettings.maxPenalties ?? 999;

                    // Eligibility for THIS month: Met conditions AND not participated this month
                    const canParticipateThisMonth = 
                        stats.missionsThisMonth >= minReq && 
                        stats.penaltyCountThisMonth < maxPenalties &&
                        !stats.hasParticipatedThisMonth;

                    // Eligibility for LAST month: Met conditions THEN AND not participated THEN
                    const canParticipateLastMonth = 
                        stats.missionsLastMonth >= minReq && 
                        stats.penaltyCountLastMonth < maxPenalties &&
                        !stats.hasParticipatedLastMonth;

                    // Show event button only if eligible for either current or previous month's missed turn
                    const showEventButton = canParticipateThisMonth || canParticipateLastMonth;

                    return (
                        <StudentCard 
                            key={student.id} 
                            student={student} 
                            groupName={groupSettings[student.group]?.name || student.group}
                            activeCouponValue={activeCouponValueByStudent.get(student.id) || 0}
                            onClick={() => onStudentClick(student)} 
                            isEventEligible={showEventButton}
                            hasParticipatedInEvent={stats.hasParticipatedThisMonth}
                            onEventClick={() => onNavigateToEvent(student)}
                        />
                    );
                })}
            </div>
        </div>
    );
};
