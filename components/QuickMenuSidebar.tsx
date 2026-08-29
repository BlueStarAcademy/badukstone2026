
import React, { useState, useEffect, useMemo } from 'react';
import type { Student, Mission, ShopItem, SidebarTab, Transaction, ShopSettings, ShopCategory, ShopSortKey, Coupon, GroupSettings, GeneralSettings, SpecialMission, EventSettings, EventMonthlyStats, IndividualMissionSeries, IndividualMissionStep, StudentMissionProgress, PersonalMissionsByStudent, PersonalMission, PersonalMissionType } from '../types';
import { MISSION_ALL_GROUPS, personalMissionAppliesToGroup } from '../utils/missionVisibility';
import { useDateKey } from '../hooks/useDateKey';
import { ConfirmationModal, ActionButton } from './modals/ConfirmationModal';
import { AssignMissionModal } from './modals/AssignMissionModal';
import { LoadPersonalMissionModal } from './modals/LoadPersonalMissionModal';
import { ModalShell } from './ui/ModalShell';


interface QuickMenuSidebarProps {
    student: Student | null;
    students: Student[];
    missions: Mission[];
    specialMissions: SpecialMission[];
    shopItems: ShopItem[];
    shopSettings: ShopSettings;
    shopCategories: ShopCategory[];
    coupons: Coupon[];
    transactions: Transaction[];
    isOpen: boolean;
    groupSettings: GroupSettings;
    generalSettings: GeneralSettings;
    eventSettings: EventSettings;
    eventMonthlyStats?: EventMonthlyStats;
    onClose: () => void;
    onAddTransaction: (studentId: string, type: Transaction['type'], description: string, amount: number, eventDetails?: { eventMonth: string }) => void;
    onUpdateTransaction: (transaction: Transaction) => void;
    onDeleteCoupon: (couponId: string) => void;
    onPurchase: (studentId: string, description: string, totalCost: number, couponDeduction: number, finalStoneCost: number) => void;
    onCancelTransaction: (transactionId: string) => void;
    onDeleteTransaction: (transactionId: string) => void;
    // FIX: Removed duplicate onTransferStones identifier.
    onTransferStones: (fromStudentId: string, toStudentId: string, amount: number) => void;
    onUpdateJosekiProgress: (studentId: string, progress: number) => void;
    onCompleteJosekiMission: (studentId: string) => void;
    onUpdateContinuousMissionName?: (studentId: string, name: string) => void;
    onUpdateStudentRank: (studentId: string, rank: string) => void;
    onAssignSpecialMission: (studentId: string, specificMissionId?: string) => void;
    onClearSpecialMission: (studentId: string) => void;
    onAdjustMissionCount: (studentId: string, delta: number) => void;
    personalMissions: PersonalMissionsByStudent;
    onAddPersonalMission: (studentId: string, mission: { title: string; stones: number; no: number; missionType?: PersonalMissionType; targetGroups?: string[] }) => void;
    onUpdatePersonalMissionScore: (studentId: string, missionId: string, newStones: number) => void;
    onUpdatePersonalMission: (studentId: string, missionId: string, payload: { title?: string; stones?: number; no?: number; missionType?: PersonalMissionType; targetGroups?: string[] }) => void;
    onDeletePersonalMission: (studentId: string, missionId: string) => void;
    onReorderPersonalMissions: (studentId: string, orderedMissionIds: string[]) => void;
    onCompletePersonalMission: (studentId: string, missionId: string) => void;
    individualMissionSeries?: IndividualMissionSeries[];
    studentMissionProgress?: StudentMissionProgress;
    onAssignIndividualMission?: (studentId: string, seriesId: string, currentStepIndex: number) => void;
    onUnassignIndividualMission?: (studentId: string) => void;
    onCompleteIndividualStep?: (studentId: string, amount: number) => void;
}

export const QuickMenuSidebar = (props: QuickMenuSidebarProps) => {
    const { 
        student, students, missions, specialMissions, shopItems, shopSettings, shopCategories, coupons, transactions, 
        isOpen, groupSettings, generalSettings, eventSettings, eventMonthlyStats, onClose, onAddTransaction, onUpdateTransaction, 
        onDeleteCoupon, onPurchase, onCancelTransaction, onDeleteTransaction, onTransferStones, 
        onUpdateJosekiProgress, onCompleteJosekiMission, onAssignSpecialMission, onClearSpecialMission,
        onUpdateContinuousMissionName, onUpdateStudentRank, onAdjustMissionCount,
        personalMissions, onAddPersonalMission, onUpdatePersonalMissionScore, onUpdatePersonalMission, onDeletePersonalMission, onReorderPersonalMissions, onCompletePersonalMission,
        individualMissionSeries = [], studentMissionProgress = {},
        onAssignIndividualMission, onUnassignIndividualMission, onCompleteIndividualStep
    } = props;

    const dateKey = useDateKey();
    const [activeTab, setActiveTab] = useState<SidebarTab>('missions');
    const [sendAmount, setSendAmount] = useState('');
    const [sendReason, setSendReason] = useState('');
    const [transferAmount, setTransferAmount] = useState('');
    const [recipientId, setRecipientId] = useState('');
    const [josekiInput, setJosekiInput] = useState('1');
    const [missionNameInput, setMissionNameInput] = useState('');
    const [personalMissionScoreInput, setPersonalMissionScoreInput] = useState('');
    const [personalMissionType, setPersonalMissionType] = useState<PersonalMissionType>('continuous');

    // Penalty State
    const [penaltyAmount, setPenaltyAmount] = useState('');

    // Shop state
    const [cart, setCart] = useState<Map<string, number>>(new Map());
    const [shopCategory, setShopCategory] = useState<ShopCategory | '전체'>('전체');
    const [shopSortKey, setShopSortKey] = useState<ShopSortKey>('name');
    const [shopSearchTerm, setShopSearchTerm] = useState('');
    const [shopPriceRange, setShopPriceRange] = useState('all');
    const [tempDiscount, setTempDiscount] = useState(0);


    // History state
    const [editingTransaction, setEditingTransaction] = useState<{ id: string; timestamp: string } | null>(null);
    const [transactionToCancel, setTransactionToCancel] = useState<Transaction | null>(null);
    const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);

    // Partial score modal state
    const [partialMission, setPartialMission] = useState<Mission | null>(null);
    const [partialAmount, setPartialAmount] = useState('');

    // Special Mission View Answer State
    const [showSpecialAnswer, setShowSpecialAnswer] = useState(false);

    // 개인 미션 할당 모달 / 불러오기 모달 / 개인 미션 수정 모달
    const [showAssignIndividualModal, setShowAssignIndividualModal] = useState(false);
    const [showLoadMissionModal, setShowLoadMissionModal] = useState(false);
    const [editingPersonalMission, setEditingPersonalMission] = useState<PersonalMission | null>(null);
    const [editPersonalTitle, setEditPersonalTitle] = useState('');
    const [editPersonalStones, setEditPersonalStones] = useState('');
    const [editPersonalNo, setEditPersonalNo] = useState('');
    const [editPersonalType, setEditPersonalType] = useState<PersonalMissionType>('continuous');
    const [personalMissionTargetGroups, setPersonalMissionTargetGroups] = useState<string[]>([MISSION_ALL_GROUPS]);
    const [editPersonalTargetGroups, setEditPersonalTargetGroups] = useState<string[]>([MISSION_ALL_GROUPS]);
    const [draggedMissionId, setDraggedMissionId] = useState<string | null>(null);
    const [dragOverMissionId, setDragOverMissionId] = useState<string | null>(null);
    const [personalMissionFilter, setPersonalMissionFilter] = useState<'all' | 'continuous' | 'weekly' | 'monthly' | 'achievement'>('all');

    const [isEditRankOpen, setIsEditRankOpen] = useState(false);
    const [editRankValue, setEditRankValue] = useState('');

    // 학생이 바뀌거나 사이드바가 닫힐 때 상태 초기화
    useEffect(() => {
        if (student) {
            setJosekiInput(String(student.josekiProgress || 1));
            setMissionNameInput(student.continuousMissionName || '');
            setPersonalMissionScoreInput(String(generalSettings.josekiMissionValue));
            setShowSpecialAnswer(false); 
            setEditRankValue(student.rank);
        }
        if (!isOpen) {
            setActiveTab('missions');
            setSendAmount('');
            setSendReason('');
            setTransferAmount('');
            setRecipientId('');
            setCart(new Map());
            setTempDiscount(0);
            setEditingTransaction(null);
            setShopSearchTerm('');
            setShopPriceRange('all');
            setPartialMission(null);
            setPartialAmount('');
            setPenaltyAmount('');
            setShowSpecialAnswer(false);
            setShowAssignIndividualModal(false);
            setShowLoadMissionModal(false);
            setPersonalMissionScoreInput('');
            setEditingPersonalMission(null);
            setIsEditRankOpen(false);
            setPersonalMissionTargetGroups([MISSION_ALL_GROUPS]);
            setEditPersonalTargetGroups([MISSION_ALL_GROUPS]);
        }
    }, [isOpen, student?.id, generalSettings.josekiMissionValue]);

    useEffect(() => {
        if (!isOpen) return;

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    // Mission Stats Logic
    const missionStats = useMemo(() => {
        if (!student) return { lastMonth: 0, thisMonth: 0, remaining: 0 };
        
        const now = new Date();
        const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

        const thisMonthKey = `${now.getFullYear()}-${now.getMonth()}`;
        const lastMonthKey = `${firstOfLastMonth.getFullYear()}-${firstOfLastMonth.getMonth()}`;
        const storedThis = eventMonthlyStats?.[thisMonthKey]?.[student.id];
        const storedLast = eventMonthlyStats?.[lastMonthKey]?.[student.id];

        const filterMissions = (start: Date, end: Date) => {
            return transactions.filter(t => 
                t.studentId === student.id &&
                (t.type === 'mission' || t.type === 'attendance' || t.type === 'special_mission' || t.type === 'mission_adjustment') &&
                t.status === 'active' &&
                new Date(t.timestamp) >= start &&
                new Date(t.timestamp) <= end
            ).reduce((acc, t) => {
                if (t.type === 'mission_adjustment') {
                    return acc + (t.missionCountDelta || 0);
                }
                return acc + 1;
            }, 0);
        };

        const thisMonthFromTx = filterMissions(firstOfThisMonth, new Date());
        const lastMonthFromTx = filterMissions(firstOfLastMonth, lastOfLastMonth);
        const thisMonthCount = storedThis?.missions !== undefined ? storedThis.missions : thisMonthFromTx;
        const lastMonthCount = storedLast?.missions !== undefined ? storedLast.missions : lastMonthFromTx;
        const minReq = eventSettings.minMissionsToSpin ?? 10;
        const remaining = Math.max(0, minReq - thisMonthCount);

        return { lastMonth: lastMonthCount, thisMonth: thisMonthCount, remaining };
    }, [student, transactions, eventMonthlyStats, eventSettings.minMissionsToSpin, dateKey]);

    // 이번 달 감점 통계 계산
    const monthlyPenaltyStats = useMemo(() => {
        if (!student) return { count: 0, total: 0 };
        const now = new Date();
        const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const thisMonthKey = `${now.getFullYear()}-${now.getMonth()}`;
        const stored = eventMonthlyStats?.[thisMonthKey]?.[student.id];
        
        const penaltyTxs = transactions.filter(t => 
            t.studentId === student.id &&
            t.type === 'penalty' &&
            t.status === 'active' &&
            new Date(t.timestamp) >= firstOfThisMonth
        );
        const count = stored?.penalties !== undefined ? stored.penalties : penaltyTxs.length;

        return {
            count,
            total: Math.abs(penaltyTxs.reduce((sum, t) => sum + t.amount, 0))
        };
    }, [student, transactions, eventMonthlyStats, dateKey]);

    const handleOpenPartialMissionModal = (mission: Mission) => {
        setPartialMission(mission);
        setPartialAmount(String(mission.stones));
    };

    const handlePartialMissionSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!student || !partialMission) return;

        const amount = parseInt(partialAmount, 10);
        if (isNaN(amount) || amount <= 0 || amount > partialMission.stones) {
            alert(`1에서 ${partialMission.stones} 사이의 숫자를 입력해주세요.`);
            return;
        }

        const isSpecial = partialMission.description.startsWith('[특별]');
        onAddTransaction(student.id, isSpecial ? 'special_mission' : 'mission', `${partialMission.description} (부분 점수)`, amount);
        
        setPartialMission(null);
        setPartialAmount('');
    };

    const handleMissionComplete = (mission: Mission) => {
        if (!student) return;
        if (mission.type === 'attendance') {
            onAddTransaction(student.id, 'attendance', mission.description, mission.stones);
        } else {
            onAddTransaction(student.id, 'mission', mission.description, mission.stones);
        }
    };

    const handleSendStones = (e: React.FormEvent) => {
        e.preventDefault();
        const amount = parseInt(sendAmount, 10) || 0;
        if (!student || amount === 0) return;
        const description = sendReason.trim() || (amount > 0 ? '스톤 수동 지급' : '스톤 수동 차감');
        onAddTransaction(student.id, 'adjustment', description, amount);
        setSendAmount('');
        setSendReason('');
    };

    const handleApplyPenalty = (e: React.FormEvent) => {
        e.preventDefault();
        const amount = parseInt(penaltyAmount, 10) || 0;
        if (!student || amount <= 0) {
            alert('차감할 점수를 입력해주세요.');
            return;
        }
        onAddTransaction(student.id, 'penalty', '예절 불량 감점', -amount);
        setPenaltyAmount('');
    };

    const handleTransfer = (e: React.FormEvent) => {
        e.preventDefault();
        const amount = parseInt(transferAmount, 10) || 0;
        if (!student || !recipientId || amount <= 0) {
            alert('받는 학생과 보낼 스톤을 정확히 입력해주세요.');
            return;
        }
        onTransferStones(student.id, recipientId, amount);
        setTransferAmount('');
        setRecipientId('');
    };

    const handleUpdateJoseki = () => {
        if (!student) return;
        const newProgress = parseInt(josekiInput, 10);
        if (!isNaN(newProgress) && newProgress > 0) {
            onUpdateJosekiProgress(student.id, newProgress);
        } else {
            setJosekiInput(String(student.josekiProgress || 1));
        }
        // 미션 내용도 함께 저장
        if (onUpdateContinuousMissionName) {
            if (personalMissionType === 'continuous') {
                onUpdateContinuousMissionName(student.id, missionNameInput);
            }
        }
        const trimmed = missionNameInput.trim();
        const score = parseInt(personalMissionScoreInput || String(generalSettings.josekiMissionValue), 10);
        const isValid = trimmed && !isNaN(score) && score > 0;
        const validNo = personalMissionType === 'continuous' ? (!isNaN(newProgress) && newProgress > 0) : true;
        if (isValid && validNo) {
            const tg = personalMissionTargetGroups.includes(MISSION_ALL_GROUPS)
                ? [MISSION_ALL_GROUPS]
                : [...new Set(personalMissionTargetGroups)];
            onAddPersonalMission(student.id, {
                title: trimmed,
                stones: score,
                no: personalMissionType === 'continuous' ? newProgress : 0,
                missionType: personalMissionType,
                targetGroups: tg.length ? tg : [MISSION_ALL_GROUPS],
            });
        }
    };

    // --- Special Mission Logic ---
    const getKstYmdFromTimestamp = (timestamp: string): { year: number; month: number; day: number } => {
        const s = new Date(timestamp).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul', hour12: false });
        const datePart = s.split(' ')[0]; // YYYY-MM-DD
        const [year, month, day] = datePart.split('-').map(Number);
        return { year, month, day };
    };

    const pad2 = (n: number) => String(n).padStart(2, '0');
    const formatYmd = (y: number, m: number, d: number) => `${y}-${pad2(m)}-${pad2(d)}`;

    const getKstWeekKeyFromTimestamp = (timestamp?: string): string | null => {
        if (!timestamp) return null;
        const { year, month, day } = getKstYmdFromTimestamp(timestamp);
        const date = new Date(year, month - 1, day);
        const dayOfWeek = date.getDay(); // 0(Sun) - 6(Sat)
        const diffToMonday = (dayOfWeek + 6) % 7; // Monday => 0
        const monday = new Date(year, month - 1, day - diffToMonday);
        return formatYmd(monday.getFullYear(), monday.getMonth() + 1, monday.getDate());
    };

    const getKstMonthKeyFromTimestamp = (timestamp?: string): string | null => {
        if (!timestamp) return null;
        const { year, month } = getKstYmdFromTimestamp(timestamp);
        return `${year}-${month - 1}`; // 0-indexed month to match existing getMonthKey()
    };

    const currentWeekKey = useMemo(() => getKstWeekKeyFromTimestamp(new Date().toISOString()), [dateKey]);
    const currentMonthKey = useMemo(() => getKstMonthKeyFromTimestamp(new Date().toISOString()), [dateKey]);

    const todayStrInKST = useMemo(
        () => new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).split(' ')[0],
        [dateKey]
    );

    const dailySpecialMission = useMemo(() => {
        if (!student || !student.dailySpecialMissionId || student.specialMissionDate !== todayStrInKST) return null;
        return specialMissions.find(m => m.id === student.dailySpecialMissionId) || null;
    }, [student, specialMissions, todayStrInKST]);

    const isSpecialMissionCompletedToday = useMemo(() => {
        if (!student) return false;
        return transactions.some(t => 
            t.studentId === student.id && 
            t.type === 'special_mission' && 
            new Date(t.timestamp).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).startsWith(todayStrInKST) && 
            t.status === 'active'
        );
    }, [student, transactions, todayStrInKST]);

    const handleCompleteSpecialMission = () => {
        if (!student || !dailySpecialMission || isSpecialMissionCompletedToday) return;
        onAddTransaction(
            student.id, 
            'special_mission', 
            `[특별] ${dailySpecialMission.content}`, 
            dailySpecialMission.stones
        );
    };

    const handleFailSpecialMission = () => {
        if (!student || !dailySpecialMission) return;
        if (confirm('미션 도전을 포기하시겠습니까? (미션이 초기화되어 다시 뽑을 수 있습니다)')) {
            onClearSpecialMission(student.id);
            setShowSpecialAnswer(false);
        }
    };

    const handleAttendanceToday = () => {
        if (!student) return;
        onAddTransaction(student.id, 'attendance', '출석', generalSettings.attendanceStoneValue);
    };

    const attendanceTransactionToday = useMemo(() => {
        if (!student) return null;
        return transactions.find(t => 
            t.studentId === student.id && 
            t.type === 'attendance' && 
            new Date(t.timestamp).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).startsWith(todayStrInKST) && 
            t.status === 'active'
        );
    }, [student, transactions, todayStrInKST]);

    const isAttendedToday = !!attendanceTransactionToday;

    // --- Shop Logic ---
    const filteredAndSortedShopItems = useMemo(() => {
        let items = [...shopItems];
        if (shopCategory !== '전체') items = items.filter(item => item.category === shopCategory);
        if (shopSearchTerm.trim() !== '') items = items.filter(item => item.name.toLowerCase().includes(shopSearchTerm.toLowerCase()));
        if (shopPriceRange !== 'all') {
            const [min, max] = shopPriceRange.split('-').map(Number);
            items = items.filter(item => max ? (item.price >= min && item.price <= max) : item.price >= min);
        }
        items.sort((a, b) => (shopSortKey === 'price' ? a.price - b.price : a.name.localeCompare(b.name)));
        return items;
    }, [shopItems, shopCategory, shopSortKey, shopSearchTerm, shopPriceRange]);

    const handleAddToCart = (itemId: string) => {
        setCart(prev => {
            const newCart = new Map(prev);
            const currentValue = newCart.get(itemId);
            newCart.set(itemId, typeof currentValue === 'number' ? currentValue + 1 : 1);
            return newCart;
        });
    };

    const handleUpdateCartQuantity = (itemId: string, quantity: number) => {
        setCart(prev => {
            const newCart = new Map(prev);
            if (quantity > 0) newCart.set(itemId, quantity); else newCart.delete(itemId);
            return newCart;
        });
    };
    
    const validCoupons = useMemo(() => {
        if (!student) return [];
        return coupons.filter(c => c.studentId === student.id && new Date(c.expiresAt) > new Date());
    }, [coupons, student]);
    
    const availableCouponValue = useMemo(() => {
        return validCoupons.reduce((sum, coupon) => sum + coupon.value, 0);
    }, [validCoupons]);

    const cartDetails = useMemo(() => {
        let subtotal = 0;
        let totalQuantity = 0;
        const items = [];
        for (const [itemId, quantity] of cart.entries()) {
            const item = shopItems.find(i => i.id === itemId);
            if (item) {
                subtotal += item.price * quantity;
                totalQuantity += quantity;
                items.push({ ...item, quantity });
            }
        }
        const bulkDiscountRate = (totalQuantity >= 2 && shopSettings.bulkPurchaseDiscountRate > 0) ? shopSettings.bulkPurchaseDiscountRate / 100 : 0;
        const bulkDiscount = Math.floor(subtotal * bulkDiscountRate);
        const totalAfterBulk = subtotal - bulkDiscount;
        const tempDiscountRate = (tempDiscount || 0) / 100;
        const temporaryDiscount = Math.floor(totalAfterBulk * tempDiscountRate);
        
        const total = Math.max(0, totalAfterBulk - temporaryDiscount);
        const couponDeduction = Math.min(total, availableCouponValue);
        const finalStoneCost = total - couponDeduction;
        
        const isInsufficient = finalStoneCost > (student?.stones || 0);

        return { 
            items, subtotal, totalQuantity, bulkDiscount, temporaryDiscount, 
            total, couponDeduction, finalStoneCost, isInsufficient 
        };
    }, [cart, shopItems, shopSettings, availableCouponValue, tempDiscount, student?.stones]);
    
    const handleCheckout = () => {
        if (!student || cartDetails.items.length === 0) return;
        if (cartDetails.isInsufficient) {
            alert('스톤이 부족합니다!');
            return;
        }

        const description = cartDetails.items.map(item => `${item.name} x${item.quantity}`).join(', ');
        onPurchase(student.id, description, cartDetails.total, cartDetails.couponDeduction, cartDetails.finalStoneCost);
        setCart(new Map());
        setTempDiscount(0);
    };

    const handleSaveTimestamp = (transaction: Transaction, newTimestamp: string) => {
        if (!newTimestamp) {
            setEditingTransaction(null);
            return;
        }
        const updatedTransaction = { ...transaction, timestamp: new Date(newTimestamp).toISOString() };
        onUpdateTransaction(updatedTransaction);
        setEditingTransaction(null);
    };

    const groupMissions = useMemo(() => {
        if (!student) return [];
        return missions.filter(m => m.group === student.group && m.type !== 'attendance');
    }, [student, missions]);

    const missionCompletionCounts = useMemo(() => {
        if (!student) return new Map<string, number>();
        const counts = new Map<string, number>();
        transactions.filter(t => t.studentId === student.id && new Date(t.timestamp).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).startsWith(todayStrInKST)).forEach(t => {
            if (t.type === 'mission' || t.type === 'attendance' || t.type === 'special_mission') {
                let desc = t.description.replace(' (부분 점수)', '').replace('[특별] ', '');
                counts.set(desc, (counts.get(desc) || 0) + 1);
            }
        });
        return counts;
    }, [student, transactions, todayStrInKST]);

    const sortedTransactions = useMemo(() => {
        if (!student) return [];
        return transactions.filter(t => t.studentId === student.id).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [transactions, student]);

    return (
        <>
        {isOpen && <div className="quick-menu-overlay" onClick={onClose} aria-hidden="true" />}
        <aside
            className={`quick-menu-sidebar ${isOpen ? 'open' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-label={student ? `${student.name} 학생 메뉴` : '학생 메뉴'}
            aria-hidden={!isOpen}
        >
            {student && (
                <>
                    <div className="sidebar-header">
                        <button className="close-btn" onClick={onClose} aria-label="학생 메뉴 닫기">&times;</button>
                        <h2>{student.name}</h2>
                        <p className="sidebar-student-meta">
                            <span>{student.rank}</span>
                            <button
                                type="button"
                                className="btn-sm sidebar-rank-edit"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsEditRankOpen(true);
                                    setEditRankValue(student.rank);
                                }}
                                title="급수 수정"
                                aria-label="급수 수정"
                            >
                                ✏️
                            </button>
                            <span>({groupSettings[student.group]?.name || student.group})</span>
                        </p>
                        
                        <div className="header-stats-row">
                             <div className="stat-item">
                                <label>보유 스톤</label>
                                <strong>{student.stones}<span> / {student.maxStones}</span></strong>
                            </div>
                            <div className="stat-item stat-item-bordered">
                                <label>미션 달성 (전월/당월)</label>
                                <div className="mission-count-control">
                                    <strong>{missionStats.lastMonth} <span>/</span> {missionStats.thisMonth}</strong>
                                    <div className="mission-count-buttons">
                                        <button 
                                            onClick={() => onAdjustMissionCount(student.id, 1)} 
                                            title="미션 횟수 1 증가"
                                            aria-label="미션 횟수 1 증가"
                                        >
                                            ▲
                                        </button>
                                        <button 
                                            onClick={() => onAdjustMissionCount(student.id, -1)} 
                                            title="미션 횟수 1 감소"
                                            aria-label="미션 횟수 1 감소"
                                        >
                                            ▼
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="stat-item stat-item-bordered">
                                <label>이벤트까지</label>
                                <strong className={missionStats.remaining === 0 ? 'stat-achieved' : ''}>{missionStats.remaining === 0 ? '달성!' : `${missionStats.remaining}회`}</strong>
                            </div>
                        </div>
                    </div>
                    <div className="sidebar-tabs">
                        <button className={`tab-item ${activeTab === 'missions' ? 'active' : ''}`} onClick={() => setActiveTab('missions')}>오늘의 미션</button>
                        <button className={`tab-item ${activeTab === 'personal_missions' ? 'active' : ''}`} onClick={() => setActiveTab('personal_missions')}>개인미션</button>
                        <button className={`tab-item ${activeTab === 'shop' ? 'active' : ''}`} onClick={() => setActiveTab('shop')}>상점</button>
                        <button className={`tab-item ${activeTab === 'coupons' ? 'active' : ''}`} onClick={() => setActiveTab('coupons')}>쿠폰함</button>
                        <button className={`tab-item ${activeTab === 'send' ? 'active' : ''}`} onClick={() => setActiveTab('send')}>스톤 관리</button>
                        <button className={`tab-item ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>활동 기록</button>
                    </div>
                    <div className={`sidebar-content ${activeTab === 'shop' ? 'shop-mode' : ''}`}>
                        {activeTab === 'missions' && (
                           <>
                                <div className="mission-top-row-triple">
                                    <div className="mission-top-box attendance-box">
                                        <h4>오늘 출석</h4>
                                        <div className="attendance-content">
                                            {isAttendedToday && attendanceTransactionToday ? (
                                                <div className="attendance-status-wrap">
                                                    <div className="status-badge success">출석 완료</div>
                                                    <div className="attendance-time-row">
                                                        {editingTransaction?.id === attendanceTransactionToday.id ? (
                                                            <div className="timestamp-edit-inline">
                                                                <input 
                                                                    type="datetime-local" 
                                                                    defaultValue={new Date(new Date(attendanceTransactionToday.timestamp).getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16)} 
                                                                    onBlur={(e) => handleSaveTimestamp(attendanceTransactionToday, e.target.value)} 
                                                                    autoFocus 
                                                                />
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <span>{new Date(attendanceTransactionToday.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                                                                <button className="icon-btn-edit" onClick={() => setEditingTransaction({id: attendanceTransactionToday.id, timestamp: attendanceTransactionToday.timestamp})} title="시간 수정">✎</button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <button className="btn primary attendance-btn" onClick={handleAttendanceToday}>출석 체크 (+{generalSettings.attendanceStoneValue})</button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="mission-top-box penalty-box">
                                        <h4>예절 불량 감점</h4>
                                        <div className="penalty-content">
                                            <form onSubmit={handleApplyPenalty} className="penalty-form-inline">
                                                <input 
                                                    type="number" 
                                                    placeholder="점수" 
                                                    className="penalty-input-sm"
                                                    value={penaltyAmount} 
                                                    onChange={e => setPenaltyAmount(e.target.value)} 
                                                    min="1" 
                                                />
                                                <button type="submit" className="btn-sm danger penalty-btn-sm">차감</button>
                                            </form>
                                            <div className="penalty-stats-text">
                                                <span className="penalty-stats">이번달: {monthlyPenaltyStats.count}회 / -{monthlyPenaltyStats.total}점</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className={`mission-top-box special-box ${dailySpecialMission ? 'revealed' : ''}`}>
                                        <h4>오늘의 특별 미션</h4>
                                        <div className="special-content">
                                            {dailySpecialMission ? (
                                                <div className="special-mission-display">
                                                    <div className="special-mission-text">
                                                        <div className="difficulty-badge">
                                                            {'★'.repeat(dailySpecialMission.stars)}
                                                        </div>
                                                        <strong>{dailySpecialMission.content}</strong>
                                                    </div>
                                                    
                                                    <div className="special-actions">
                                                        <div className="special-mission-answer-container">
                                                            {(showSpecialAnswer || isSpecialMissionCompletedToday) && dailySpecialMission.answer ? (
                                                                <div className="special-mission-answer">
                                                                    <span className="answer-label">답:</span>
                                                                    <span className="answer-text">{dailySpecialMission.answer}</span>
                                                                </div>
                                                            ) : (
                                                                <div className="special-mission-placeholder" onClick={() => setShowSpecialAnswer(true)}>
                                                                    <span>[정답 확인]</span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <span className="mission-stones">+{dailySpecialMission.stones}</span>
                                                        
                                                        <div className="special-actions-buttons">
                                                            {isSpecialMissionCompletedToday ? (
                                                                <div className="status-badge success special-status-badge-sm">완료</div>
                                                            ) : (
                                                                <>
                                                                    {showSpecialAnswer ? (
                                                                        <>
                                                                            <button className="btn-sm success" onClick={handleCompleteSpecialMission} disabled={student.stones >= student.maxStones}>성공</button>
                                                                            <button className="btn-sm danger" onClick={handleFailSpecialMission}>실패</button>
                                                                        </>
                                                                    ) : (
                                                                        <button className="btn-sm special-answer-btn" onClick={() => setShowSpecialAnswer(true)}>정답</button>
                                                                    )}
                                                                    <button 
                                                                        className="btn-sm" 
                                                                        onClick={() => confirm('다른 미션으로 변경하시겠습니까?') && onAssignSpecialMission(student.id)} 
                                                                        title="다시 뽑기"
                                                                    >🔄</button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="special-draw-zone">
                                                    <span className="draw-placeholder">?</span>
                                                    <button className="btn draw-btn" onClick={() => onAssignSpecialMission(student.id)}>
                                                        특별 미션 뽑기
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <h3 className="class-mission-heading">수업 미션</h3>
                                <ul className="mission-list">
                                    {groupMissions.map((mission: any) => {
                                        const completionsToday = missionCompletionCounts.get(mission.description) || 0;

                                        return (
                                            <li key={mission.id} className="mission-item">
                                                <div className="mission-item-content">
                                                    <span className="mission-item-title">
                                                        {mission.description}
                                                    </span>
                                                </div>
                                                <div className="mission-actions">
                                                    {completionsToday > 0 && (
                                                        <span className="mission-item-completions">({completionsToday}회)</span>
                                                    )}
                                                    <span className="mission-stones">+{mission.stones}</span>
                                                    <button className="btn-sm" onClick={() => handleOpenPartialMissionModal(mission)} disabled={student.stones >= student.maxStones}>부분</button>
                                                    <button className="btn-sm primary" onClick={() => handleMissionComplete(mission)} disabled={student.stones >= student.maxStones}>완료</button>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                           </>
                        )}
                        {activeTab === 'personal_missions' && student && (
                           <>
                                <div className="mission-control-wrapper personal-mission-section">
                                    <span className="control-label-mini control-label-mini--primary">개인 미션 추가</span>
                                    <div className="personal-mission-type-tabs">
                                        <button
                                            type="button"
                                            className={`btn-sm ${personalMissionType === 'continuous' ? 'primary' : ''}`}
                                            onClick={() => setPersonalMissionType('continuous')}
                                        >
                                            연속 미션
                                        </button>
                                        <button
                                            type="button"
                                            className={`btn-sm ${personalMissionType === 'weekly' ? 'primary' : ''}`}
                                            onClick={() => setPersonalMissionType('weekly')}
                                        >
                                            주간 미션
                                        </button>
                                        <button
                                            type="button"
                                            className={`btn-sm ${personalMissionType === 'monthly' ? 'primary' : ''}`}
                                            onClick={() => setPersonalMissionType('monthly')}
                                        >
                                            월간 미션
                                        </button>
                                        <button
                                            type="button"
                                            className={`btn-sm ${personalMissionType === 'achievement' ? 'primary' : ''}`}
                                            onClick={() => setPersonalMissionType('achievement')}
                                        >
                                            업적 미션 (1회성)
                                        </button>
                                    </div>
                                    <div className="continuous-mission-line continuous-mission-line--wrap">
                                        <input 
                                            type="text" 
                                            className="mission-name-input"
                                            placeholder={
                                                personalMissionType === 'continuous'
                                                    ? '미션 내용 (예: 정석 외우기)'
                                                    : personalMissionType === 'weekly'
                                                        ? '미션 내용 (예: 이번 주 3승 달성)'
                                                        : personalMissionType === 'monthly'
                                                            ? '미션 내용 (예: 이번 달 승률 80% 달성)'
                                                            : '미션 내용 (예: 10단 대국 1승)'
                                            }
                                            value={missionNameInput} 
                                            onChange={e => setMissionNameInput(e.target.value)} 
                                        />
                                        {personalMissionType === 'continuous' && (
                                            <div className="mission-progress-group">
                                                <label>No.</label>
                                                <input 
                                                    type="number" 
                                                    className="mission-no-input"
                                                    value={josekiInput} 
                                                    onChange={e => setJosekiInput(e.target.value)} 
                                                    min="1" 
                                                />
                                            </div>
                                        )}
                                        <input
                                            type="number"
                                            className="mission-no-input mission-score-input-sm"
                                            value={personalMissionScoreInput}
                                            onChange={e => setPersonalMissionScoreInput(e.target.value)}
                                            min="1"
                                            placeholder={String(generalSettings.josekiMissionValue)}
                                        />
                                        <button className="btn-sm" onClick={handleUpdateJoseki}>저장</button>
                                    </div>
                                    <div className="target-group-row">
                                        <span className="target-group-label">노출 반:</span>
                                        <label className="target-group-checkbox target-group-checkbox--strong">
                                            <input
                                                type="checkbox"
                                                checked={personalMissionTargetGroups.includes(MISSION_ALL_GROUPS)}
                                                onChange={e => setPersonalMissionTargetGroups(e.target.checked ? [MISSION_ALL_GROUPS] : (generalSettings.groupOrder[0] ? [generalSettings.groupOrder[0]] : [MISSION_ALL_GROUPS]))}
                                            />
                                            공동
                                        </label>
                                        {generalSettings.groupOrder.map(gk => (
                                            <label key={gk} className="target-group-checkbox">
                                                <input
                                                    type="checkbox"
                                                    checked={!personalMissionTargetGroups.includes(MISSION_ALL_GROUPS) && personalMissionTargetGroups.includes(gk)}
                                                    onChange={() => {
                                                        if (personalMissionTargetGroups.includes(MISSION_ALL_GROUPS)) {
                                                            setPersonalMissionTargetGroups([gk]);
                                                        } else {
                                                            const has = personalMissionTargetGroups.includes(gk);
                                                            const next = has ? personalMissionTargetGroups.filter(x => x !== gk) : [...personalMissionTargetGroups, gk];
                                                            setPersonalMissionTargetGroups(next.length === 0 ? [MISSION_ALL_GROUPS] : next);
                                                        }
                                                    }}
                                                />
                                                {groupSettings[gk]?.name || gk}
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="personal-mission-section-header">
                                    <h3 className="personal-mission-section-title">개인 미션</h3>
                                    {onAssignIndividualMission && (
                                        <button type="button" className="btn-sm" onClick={() => setShowLoadMissionModal(true)}>
                                            개인 미션 불러오기
                                        </button>
                                    )}
                                </div>
                                <p className="personal-mission-section-desc">
                                    위 폼에서 추가하는 미션은 이 학생 전용입니다. 반마다 기본으로 붙이는 미션은 관리자 → 단체 미션 탭 → 「그룹 기본 개인 미션」에서 설정합니다.
                                </p>
                                <div className="personal-mission-filter-tabs">
                                    {(['all', 'continuous', 'weekly', 'monthly', 'achievement'] as const).map(f => (
                                        <button
                                            key={f}
                                            type="button"
                                            className={`btn-sm ${personalMissionFilter === f ? 'primary' : ''}`}
                                            onClick={() => setPersonalMissionFilter(f)}
                                        >
                                            {f === 'all'
                                                ? '전체'
                                                : f === 'continuous'
                                                    ? '연속'
                                                    : f === 'weekly'
                                                        ? '주간'
                                                        : f === 'monthly'
                                                            ? '월간'
                                                            : '업적'}
                                        </button>
                                    ))}
                                </div>
                                {(() => {
                                    const list = personalMissions[student.id] || [];
                                    const forStudentGroup = list.filter(m => personalMissionAppliesToGroup(m.targetGroups, student.group));
                                    const filteredList = forStudentGroup.filter(m => {
                                        if (personalMissionFilter === 'all') return true;
                                        const type = (m.missionType || 'continuous') as PersonalMissionType;
                                        return type === personalMissionFilter;
                                    });
                                    const handleDragStart = (e: React.DragEvent, missionId: string) => {
                                        setDraggedMissionId(missionId);
                                        e.dataTransfer.setData('text/plain', missionId);
                                        e.dataTransfer.effectAllowed = 'move';
                                    };
                                    const handleDragOver = (e: React.DragEvent, missionId: string) => {
                                        e.preventDefault();
                                        e.dataTransfer.dropEffect = 'move';
                                        setDragOverMissionId(missionId);
                                    };
                                    const handleDragLeave = () => setDragOverMissionId(null);
                                    const handleDrop = (e: React.DragEvent, targetMissionId: string) => {
                                        e.preventDefault();
                                        setDragOverMissionId(null);
                                        setDraggedMissionId(null);
                                        const sourceId = e.dataTransfer.getData('text/plain');
                                        if (!sourceId || sourceId === targetMissionId) return;
                                        const ids = list.map(x => x.id);
                                        const fromIdx = ids.indexOf(sourceId);
                                        const toIdx = ids.indexOf(targetMissionId);
                                        if (fromIdx === -1 || toIdx === -1) return;
                                        const reordered = [...ids];
                                        reordered.splice(fromIdx, 1);
                                        reordered.splice(toIdx, 0, sourceId);
                                        onReorderPersonalMissions(student.id, reordered);
                                    };
                                    const handleDragEnd = () => {
                                        setDraggedMissionId(null);
                                        setDragOverMissionId(null);
                                    };
                                    if (list.length === 0) {
                                        return (
                                            <div className="personal-mission-empty">
                                                <p>등록된 개인 미션이 없습니다.</p>
                                            </div>
                                        );
                                    }
                                    if (forStudentGroup.length === 0) {
                                        return (
                                            <div className="personal-mission-empty">
                                                <p>이 반에 노출되도록 설정된 개인 미션이 없습니다. (다른 반 전용 미션만 있는 경우)</p>
                                            </div>
                                        );
                                    }
                                    if (filteredList.length === 0) {
                                        return (
                                            <div className="personal-mission-empty">
                                                <p>
                                                    {personalMissionFilter === 'continuous'
                                                        ? '연속 미션이 없습니다.'
                                                        : personalMissionFilter === 'weekly'
                                                            ? '주간 미션이 없습니다.'
                                                            : personalMissionFilter === 'monthly'
                                                                ? '월간 미션이 없습니다.'
                                                                : personalMissionFilter === 'achievement'
                                                                    ? '업적 미션이 없습니다.'
                                                                    : '등록된 개인 미션이 없습니다.'}
                                                </p>
                                            </div>
                                        );
                                    }
                                    return (
                                        <div className="personal-mission-cards-grid">
                                            {filteredList.map(m => (
                                                <div
                                                    key={m.id}
                                                    className={`personal-mission-card ${draggedMissionId === m.id ? 'personal-mission-card-dragging' : ''} ${dragOverMissionId === m.id ? 'personal-mission-card-drag-over' : ''}`}
                                                    draggable
                                                    onDragStart={e => handleDragStart(e, m.id)}
                                                    onDragOver={e => handleDragOver(e, m.id)}
                                                    onDragLeave={handleDragLeave}
                                                    onDrop={e => handleDrop(e, m.id)}
                                                    onDragEnd={handleDragEnd}
                                                >
                                                    <div className="personal-mission-card-handle" title="드래그하여 순서 변경">⋮⋮</div>
                                                    <div className="personal-mission-card-title">
                                                        {(m.missionType || 'continuous') === 'continuous' ? (
                                                            <>No.{m.no} - {m.title}</>
                                                        ) : (
                                                            <span>
                                                                <span className={`personal-mission-badge ${(m.missionType || 'continuous')}`}>
                                                                    {(m.missionType || 'continuous') === 'weekly'
                                                                        ? '주간'
                                                                        : (m.missionType || 'continuous') === 'monthly'
                                                                            ? '월간'
                                                                            : '업적'}
                                                                </span>{' '}
                                                                {m.title}
                                                            </span>
                                                        )}
                                                        <span className="personal-mission-card-subtext">
                                                            {m.templateId
                                                                ? '그룹 기본 (관리자 템플릿)'
                                                                : (!m.targetGroups || m.targetGroups.includes(MISSION_ALL_GROUPS))
                                                                    ? '공동'
                                                                    : (m.targetGroups.map(g => groupSettings[g]?.name || g).join(', '))}
                                                        </span>
                                                    </div>
                                                    <div className="personal-mission-card-score">
                                                        <input
                                                            type="number"
                                                            value={m.stones}
                                                            min={0}
                                                            onChange={e => {
                                                                const val = parseInt(e.target.value, 10);
                                                                if (!Number.isNaN(val)) onUpdatePersonalMissionScore(student.id, m.id, val);
                                                            }}
                                                            disabled={(m.missionType || 'continuous') === 'achievement' && !!m.completedAt}
                                                        />
                                                        <span className="personal-mission-card-score-label">점</span>
                                                    </div>
                                                    <div className="personal-mission-card-actions">
                                                        {(m.missionType || 'continuous') === 'achievement' && m.completedAt ? (
                                                            <span className="personal-mission-completed-badge">완료됨</span>
                                                        ) : (m.missionType || 'continuous') === 'weekly' && m.completedAt && getKstWeekKeyFromTimestamp(m.completedAt) === currentWeekKey ? (
                                                            <span className="personal-mission-completed-badge">이번 주 완료됨</span>
                                                        ) : (m.missionType || 'continuous') === 'monthly' && m.completedAt && getKstMonthKeyFromTimestamp(m.completedAt) === currentMonthKey ? (
                                                            <span className="personal-mission-completed-badge">이번 달 완료됨</span>
                                                        ) : (
                                                            <button
                                                                className="btn-sm primary"
                                                                onClick={() => onCompletePersonalMission(student.id, m.id)}
                                                                disabled={(m.stones || 0) <= 0}
                                                            >
                                                                완료
                                                            </button>
                                                        )}
                                                        <button type="button" className="btn-sm" onClick={() => {
                                                            setEditingPersonalMission(m);
                                                            setEditPersonalTitle(m.title);
                                                            setEditPersonalStones(String(m.stones));
                                                            setEditPersonalNo(String(m.no));
                                                            setEditPersonalType((m.missionType || 'continuous'));
                                                            const tg = m.targetGroups && m.targetGroups.length > 0 ? [...m.targetGroups] : [MISSION_ALL_GROUPS];
                                                            setEditPersonalTargetGroups(tg.includes(MISSION_ALL_GROUPS) ? [MISSION_ALL_GROUPS] : tg);
                                                        }}>수정</button>
                                                        <button type="button" className="btn-sm danger" onClick={() => confirm(`"${m.title}" 미션을 삭제하시겠습니까?`) && onDeletePersonalMission(student.id, m.id)}>삭제</button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
                           </>
                        )}
                        {activeTab === 'shop' && (
                           <>
                                <div className="shop-main">
                                    <div className="shop-controls">
                                        <div className="shop-filters">{['전체', ...shopCategories].map(cat => <button key={cat} onClick={() => setShopCategory(cat)} className={`filter-btn ${shopCategory === cat ? 'active' : ''}`}>{cat}</button>)}</div>
                                        <div className="shop-search-and-filters">
                                            <div className="form-group"><input type="text" id="shop-search" placeholder="상품 이름으로 검색..." value={shopSearchTerm} onChange={e => setShopSearchTerm(e.target.value)} /></div>
                                            <div className="inline-group">
                                                <div className="sort-dropdown">
                                                    <label htmlFor="price-range">가격:</label>
                                                    <select id="price-range" value={shopPriceRange} onChange={e => setShopPriceRange(e.target.value)}>
                                                        <option value="all">전체</option><option value="0-100">1-100</option><option value="101-200">101-200</option><option value="201-500">201-500</option><option value="501">501 이상</option>
                                                    </select>
                                                </div>
                                                <div className="sort-dropdown">
                                                    <label htmlFor="shop-sort">정렬:</label>
                                                    <select id="sort-order-shop" value={shopSortKey} onChange={e => setShopSortKey(e.target.value as ShopSortKey)}>
                                                        <option value="name">이름순</option><option value="price">가격순</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="shop-list-container">
                                        <ul className="shop-list">
                                            {filteredAndSortedShopItems.map(item => {
                                                const quantityInCart = cart.get(item.id) || 0;
                                                return (
                                                    <li key={item.id} className="shop-grid-item">
                                                        <div className="shop-item-info"><span className="shop-item-category">{item.category}</span><h4 className="shop-item-name">{item.name}</h4><p className="shop-item-price">{item.price} 스톤</p></div>
                                                        <div className="shop-item-actions"><button className="btn primary" onClick={() => handleAddToCart(item.id)}>{quantityInCart > 0 ? `추가 (${quantityInCart})` : '장바구니 담기'}</button></div>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                </div>
                                <div className="shop-cart-panel">
                                    <div className="cart-panel-header"><h3>장바구니 ({cartDetails.totalQuantity}개)</h3></div>
                                    <div className="cart-panel-items">
                                        {cartDetails.items.length > 0 ? (
                                            <ul className="cart-item-list">{cartDetails.items.map(item => (
                                                <li key={item.id} className="cart-item"><span className="cart-item-name">{item.name}</span><div className="cart-item-controls"><input type="number" min="1" value={item.quantity} onChange={e => handleUpdateCartQuantity(item.id, parseInt(e.target.value) || 1)} /><span>x {item.price}</span><button onClick={() => handleUpdateCartQuantity(item.id, 0)}>&times;</button></div></li>
                                            ))}</ul>
                                        ) : <div className="empty-state-mini"><p>장바구니가 비었습니다.</p></div>}
                                    </div>
                                    <div className="cart-panel-footer">
                                        <div className="cart-total-details">
                                            <div><span>소계</span> <span>{cartDetails.subtotal}</span></div>
                                            {cartDetails.bulkDiscount > 0 && <div className="bulk-discount"><span>묶음 할인 ({shopSettings.bulkPurchaseDiscountRate}%)</span><span>-{cartDetails.bulkDiscount}</span></div>}
                                            <div className="personal-discount">
                                                <label htmlFor="temp-discount" style={{marginRight: 'auto'}}>임시 할인 (%)</label>
                                                <input type="number" id="temp-discount" value={tempDiscount} onChange={e => setTempDiscount(parseInt(e.target.value, 10) || 0)} min="0" max="100" style={{width: '60px', textAlign: 'right'}} placeholder="0" />
                                            </div>
                                            {cartDetails.temporaryDiscount > 0 && <div className="personal-discount"><span>할인 적용 금액</span><span>-{cartDetails.temporaryDiscount}</span></div>}
                                            {cartDetails.couponDeduction > 0 && <div className="coupon-deduction"><span>쿠폰 사용</span><span>-{cartDetails.couponDeduction}</span></div>}
                                            <div className="final-total">
                                                <span>{cartDetails.couponDeduction > 0 ? '추가 스톤 결제' : '최종 결제'}</span>
                                                <span className={cartDetails.isInsufficient ? 'insufficient-text' : ''}>
                                                    {cartDetails.finalStoneCost} 스톤
                                                </span>
                                            </div>
                                        </div>
                                        <button 
                                            className={`btn ${cartDetails.isInsufficient ? 'danger' : 'primary'} cart-checkout-btn`} 
                                            onClick={handleCheckout} 
                                            disabled={cartDetails.isInsufficient || cartDetails.items.length === 0}
                                        >
                                            {cartDetails.isInsufficient 
                                                ? `금액 부족 (보유: ${student.stones} 스톤)` 
                                                : `${cartDetails.finalStoneCost} 스톤으로 결제`}
                                        </button>
                                    </div>
                                </div>
                           </>
                        )}
                        {activeTab === 'coupons' && (
                            <ul className="coupon-list">
                                {validCoupons.length > 0 ? validCoupons.map(coupon => (
                                    <li key={coupon.id} className="coupon-item">
                                        <div className="coupon-info"><span className="coupon-description">{coupon.description}</span><span className="coupon-details">기한: {new Date(coupon.expiresAt).toLocaleDateString('ko-KR')}까지</span></div>
                                        <div className="coupon-actions"><span className="coupon-value">{coupon.value} 스톤</span><button className="btn-sm danger" onClick={() => onDeleteCoupon(coupon.id)}>삭제</button></div>
                                    </li>
                                )) : <p>사용 가능한 쿠폰이 없습니다.</p>}
                            </ul>
                        )}
                        {activeTab === 'send' && (
                            <div className="stone-mgmt-row">
                                <div className="stone-mgmt-card">
                                    <h3>스톤 수동 지급/차감</h3>
                                    <form onSubmit={handleSendStones}>
                                        <div className="form-group">
                                            <label htmlFor="sendAmount">지급/차감할 스톤</label>
                                            <input type="number" id="sendAmount" value={sendAmount} onChange={e => setSendAmount(e.target.value)} placeholder="0" />
                                            <small className="form-hint">양수는 지급, 음수는 차감입니다.</small>
                                        </div>
                                        <div className="form-group">
                                            <label htmlFor="sendReason">사유</label>
                                            <input type="text" id="sendReason" value={sendReason} onChange={e => setSendReason(e.target.value)} placeholder="예: 착한 일을 해서 스톤 지급" />
                                        </div>
                                        <button type="submit" className="btn primary stone-mgmt-submit-btn">적용</button>
                                    </form>
                                </div>

                                <div className="stone-mgmt-card">
                                    <h3>물물교환</h3>
                                    <form onSubmit={handleTransfer}>
                                        <div className="form-group">
                                            <label htmlFor="recipient">받는 학생</label>
                                            <select id="recipient" value={recipientId} onChange={e => setRecipientId(e.target.value)} required>
                                                <option value="" disabled>학생 선택...</option>
                                                {students.filter(s => s.id !== student.id && s.status === '재원').sort((a,b) => a.name.localeCompare(b.name)).map(s => <option key={s.id} value={s.id}>{s.name} ({s.rank})</option>)}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label htmlFor="transferAmount">보낼 스톤</label>
                                            <input type="number" id="transferAmount" value={transferAmount} onChange={e => setTransferAmount(e.target.value)} min="1" max={student.stones} required placeholder="0" />
                                        </div>
                                        <button 
                                            type="submit" 
                                            className="btn primary stone-mgmt-submit-btn" 
                                            disabled={(parseInt(transferAmount, 10) || 0) <= 0 || !recipientId || student.stones < (parseInt(transferAmount, 10) || 0)}
                                        >
                                            보내기
                                        </button>
                                    </form>
                                </div>
                            </div>
                        )}
                        {activeTab === 'history' && (
                            <div className="history-table-container">
                                <table className="history-compact-table">
                                    <thead>
                                        <tr>
                                            <th>일시</th>
                                            <th>내용</th>
                                            <th>스톤</th>
                                            <th>관리</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedTransactions.length > 0 ? sortedTransactions.map(t => {
                                            const isCancellable = t.status !== 'cancelled' && !t.description.includes('내역 취소');
                                            const dateObj = new Date(t.timestamp);
                                            const dateStr = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
                                            const timeStr = dateObj.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
                                            
                                            return (
                                                <tr key={t.id} className={t.status === 'cancelled' ? 'cancelled-row' : ''}>
                                                    <td className="history-date-cell">
                                                        <span className="date">{dateStr}</span>
                                                        <span className="time">{timeStr}</span>
                                                    </td>
                                                    <td className="history-desc-cell">
                                                        {editingTransaction?.id === t.id ? (
                                                            <div className="timestamp-edit-inline">
                                                                <input 
                                                                    type="datetime-local" 
                                                                    defaultValue={new Date(new Date(t.timestamp).getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16)} 
                                                                    onBlur={(e) => handleSaveTimestamp(t, e.target.value)} 
                                                                    autoFocus 
                                                                />
                                                            </div>
                                                        ) : (
                                                            <div className="desc-content-wrapper">
                                                                <span className="desc-text" title={t.description}>{t.description}</span>
                                                                {(t.description === '출석' || t.type === 'attendance' || t.type === 'chess_attendance') && (
                                                                    <button className="icon-btn-edit" onClick={() => setEditingTransaction({id: t.id, timestamp: t.timestamp})} title="시간 수정">✎</button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className={`history-amount-cell ${t.amount >= 0 ? 'pos' : 'neg'}`}>
                                                        {t.amount > 0 ? `+${t.amount}` : t.amount}
                                                    </td>
                                                    <td className="history-action-cell">
                                                        <div className="action-button-group">
                                                            {isCancellable && (
                                                                <button className="btn-icon-sm" onClick={() => setTransactionToCancel(t)} title="내역 취소">↶</button>
                                                            )}
                                                            <button className="btn-icon-sm danger" onClick={() => setTransactionToDelete(t)} title="영구 삭제">×</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        }) : (
                                            <tr>
                                                <td colSpan={4} className="empty-state-mini">활동 기록이 없습니다.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}
        </aside>
         {transactionToCancel && <ConfirmationModal message={`'${transactionToCancel.description}' 내역을 정말 취소하시겠습니까? (${-transactionToCancel.amount} 스톤이 복구됩니다)`} actions={[{ text: '닫기', onClick: () => setTransactionToCancel(null) }, { text: '취소 실행', onClick: () => { onCancelTransaction(transactionToCancel.id); setTransactionToCancel(null); }}]} onClose={() => setTransactionToCancel(null)} />}
        {transactionToDelete && <ConfirmationModal message={`'${transactionToDelete.description}' 내역을 정말 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없으며, 학생의 스톤이 변동됩니다.`} actions={[{ text: '닫기', onClick: () => setTransactionToDelete(null) }, { text: '삭제 실행', className: 'danger', onClick: () => { onDeleteTransaction(transactionToDelete.id); setTransactionToDelete(null); }}]} onClose={() => setTransactionToDelete(null)} />}
        {partialMission && (
            <ModalShell
                title="부분 점수 지급"
                size="sm"
                onClose={() => setPartialMission(null)}
                footer={
                    <>
                        <button type="button" className="btn" onClick={() => setPartialMission(null)}>취소</button>
                        <button type="submit" form="quick-menu-partial-mission-form" className="btn primary">지급</button>
                    </>
                }
            >
                <form id="quick-menu-partial-mission-form" onSubmit={handlePartialMissionSubmit}>
                    <div className="form-group"><label>미션</label><p className="inline-desc-box">{partialMission.description}</p></div>
                    <div className="form-group"><label htmlFor="partial-amount">지급할 스톤 (최대 {partialMission.stones})</label><input type="number" id="partial-amount" value={partialAmount} onChange={(e) => setPartialAmount(e.target.value)} min="1" max={partialMission.stones} required autoFocus placeholder="점수 입력" /></div>
                </form>
            </ModalShell>
        )}
        {student && showAssignIndividualModal && individualMissionSeries.length > 0 && onAssignIndividualMission && (
            <AssignMissionModal
                isOpen={showAssignIndividualModal}
                onClose={() => setShowAssignIndividualModal(false)}
                student={student}
                allSeries={individualMissionSeries}
                studentProgress={studentMissionProgress}
                onAssign={(sid, seriesId, stepIndex) => { onAssignIndividualMission(sid, seriesId, stepIndex); setShowAssignIndividualModal(false); }}
                onUnassign={(sid) => { onUnassignIndividualMission?.(sid); setShowAssignIndividualModal(false); }}
            />
        )}
        {student && showLoadMissionModal && (
            <LoadPersonalMissionModal
                isOpen={showLoadMissionModal}
                onClose={() => setShowLoadMissionModal(false)}
                currentStudentId={student.id}
                students={students}
                groupOrder={generalSettings.groupOrder}
                groupSettings={groupSettings}
                personalMissions={personalMissions}
                onAddPersonalMission={onAddPersonalMission}
                onUpdatePersonalMission={onUpdatePersonalMission}
                onDeletePersonalMission={onDeletePersonalMission}
            />
        )}
        {student && editingPersonalMission && (
            <ModalShell
                title="개인 미션 수정"
                size="sm"
                onClose={() => setEditingPersonalMission(null)}
                footer={
                    <>
                        <button type="button" className="btn" onClick={() => setEditingPersonalMission(null)}>취소</button>
                        <button type="submit" form="quick-menu-edit-personal-mission-form" className="btn primary">저장</button>
                    </>
                }
            >
                    {editingPersonalMission.templateId && (
                        <p className="form-note">
                            그룹 기본 미션입니다. 현재 진행 No.와 이 학생의 점수는 여기서 조정할 수 있습니다.
                            공통 내용·유형·대상 반은 관리자 → 「그룹 기본 개인 미션」에서 수정하세요.
                        </p>
                    )}
                    <form
                        id="quick-menu-edit-personal-mission-form"
                        onSubmit={e => {
                            e.preventDefault();
                            const stones = parseInt(editPersonalStones, 10);
                            const no = editPersonalType === 'continuous' ? parseInt(editPersonalNo, 10) : 0;
                            if (Number.isNaN(stones) || stones < 0) return;
                            if (editingPersonalMission.templateId) {
                                if (editPersonalType === 'continuous' && (Number.isNaN(no) || no < 1)) return;
                                onUpdatePersonalMission(student.id, editingPersonalMission.id, {
                                    stones,
                                    ...(editPersonalType === 'continuous' ? { no } : {}),
                                });
                                setEditingPersonalMission(null);
                                return;
                            }
                            if (!editPersonalTitle.trim()) return;
                            if (editPersonalType === 'continuous' && (Number.isNaN(no) || no < 1)) return;
                            const tg = editPersonalTargetGroups.includes(MISSION_ALL_GROUPS)
                                ? [MISSION_ALL_GROUPS]
                                : [...new Set(editPersonalTargetGroups)];
                            onUpdatePersonalMission(student.id, editingPersonalMission.id, {
                                title: editPersonalTitle.trim(),
                                stones,
                                no: editPersonalType === 'continuous' ? no : 0,
                                missionType: editPersonalType,
                                targetGroups: tg.length ? tg : [MISSION_ALL_GROUPS],
                            });
                            setEditingPersonalMission(null);
                        }}
                    >
                        {!editingPersonalMission.templateId && (
                            <>
                                <div className="form-group">
                                    <label>미션 방식</label>
                                    <div className="ui-choice-grid" role="radiogroup" aria-label="미션 방식">
                                        <label className={editPersonalType === 'continuous' ? 'selected' : ''}>
                                            <input type="radio" name="editPersonalType" checked={editPersonalType === 'continuous'} onChange={() => setEditPersonalType('continuous')} />
                                            <span>연속 미션</span>
                                        </label>
                                        <label className={editPersonalType === 'weekly' ? 'selected' : ''}>
                                            <input type="radio" name="editPersonalType" checked={editPersonalType === 'weekly'} onChange={() => setEditPersonalType('weekly')} />
                                            <span>주간 미션</span>
                                        </label>
                                        <label className={editPersonalType === 'monthly' ? 'selected' : ''}>
                                            <input type="radio" name="editPersonalType" checked={editPersonalType === 'monthly'} onChange={() => setEditPersonalType('monthly')} />
                                            <span>월간 미션</span>
                                        </label>
                                        <label className={editPersonalType === 'achievement' ? 'selected' : ''}>
                                            <input type="radio" name="editPersonalType" checked={editPersonalType === 'achievement'} onChange={() => setEditPersonalType('achievement')} />
                                            <span>업적 미션 (1회성)</span>
                                        </label>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label htmlFor="edit-personal-title">미션 내용</label>
                                    <input
                                        type="text"
                                        id="edit-personal-title"
                                        value={editPersonalTitle}
                                        onChange={e => setEditPersonalTitle(e.target.value)}
                                        placeholder="미션 내용"
                                        required
                                    />
                                </div>
                                {editPersonalType === 'continuous' && (
                                    <div className="form-group">
                                        <label htmlFor="edit-personal-no">No.</label>
                                        <input
                                            type="number"
                                            id="edit-personal-no"
                                            value={editPersonalNo}
                                            onChange={e => setEditPersonalNo(e.target.value)}
                                            min={1}
                                            required
                                        />
                                    </div>
                                )}
                            </>
                        )}
                        {editingPersonalMission.templateId && editPersonalType === 'continuous' && (
                            <div className="form-group">
                                <label htmlFor="edit-template-personal-no">현재 진행 No.</label>
                                <input
                                    type="number"
                                    id="edit-template-personal-no"
                                    value={editPersonalNo}
                                    onChange={e => setEditPersonalNo(e.target.value)}
                                    min={1}
                                    required
                                />
                            </div>
                        )}
                        <div className="form-group">
                            <label htmlFor="edit-personal-stones">점수</label>
                            <input
                                type="number"
                                id="edit-personal-stones"
                                value={editPersonalStones}
                                onChange={e => setEditPersonalStones(e.target.value)}
                                min={0}
                                required
                            />
                        </div>
                        {!editingPersonalMission.templateId && (
                            <div className="form-group">
                                <label>노출 반</label>
                                <div className="target-group-row">
                                    <label className="target-group-checkbox target-group-checkbox--strong">
                                        <input
                                            type="checkbox"
                                            checked={editPersonalTargetGroups.includes(MISSION_ALL_GROUPS)}
                                            onChange={e => setEditPersonalTargetGroups(e.target.checked ? [MISSION_ALL_GROUPS] : (generalSettings.groupOrder[0] ? [generalSettings.groupOrder[0]] : [MISSION_ALL_GROUPS]))}
                                        />
                                        공동
                                    </label>
                                    {generalSettings.groupOrder.map(gk => (
                                        <label key={gk} className="target-group-checkbox">
                                            <input
                                                type="checkbox"
                                                checked={!editPersonalTargetGroups.includes(MISSION_ALL_GROUPS) && editPersonalTargetGroups.includes(gk)}
                                                onChange={() => {
                                                    if (editPersonalTargetGroups.includes(MISSION_ALL_GROUPS)) {
                                                        setEditPersonalTargetGroups([gk]);
                                                    } else {
                                                        const has = editPersonalTargetGroups.includes(gk);
                                                        const next = has ? editPersonalTargetGroups.filter(x => x !== gk) : [...editPersonalTargetGroups, gk];
                                                        setEditPersonalTargetGroups(next.length === 0 ? [MISSION_ALL_GROUPS] : next);
                                                    }
                                                }}
                                            />
                                            {groupSettings[gk]?.name || gk}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                    </form>
            </ModalShell>
        )}
        {student && isEditRankOpen && (
            <ModalShell
                title="급수 수정"
                size="sm"
                onClose={() => setIsEditRankOpen(false)}
                footer={
                    <>
                        <button type="button" className="btn" onClick={() => setIsEditRankOpen(false)}>
                            취소
                        </button>
                        <button type="submit" form="quick-menu-edit-rank-form" className="btn primary">
                            저장
                        </button>
                    </>
                }
            >
                    <form
                        id="quick-menu-edit-rank-form"
                        onSubmit={(e) => {
                            e.preventDefault();
                            const nextRank = editRankValue.trim();
                            if (!nextRank) return;
                            onUpdateStudentRank(student.id, nextRank);
                            setIsEditRankOpen(false);
                        }}
                    >
                        <div className="form-group">
                            <label htmlFor="edit-rank">급수</label>
                            <input
                                id="edit-rank"
                                type="text"
                                value={editRankValue}
                                onChange={(e) => setEditRankValue(e.target.value)}
                                placeholder="예: 30급 / 1단 / 입문"
                                required
                                autoFocus
                            />
                        </div>
                    </form>
            </ModalShell>
        )}
        </>
    );
};
