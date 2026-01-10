
import React, { useState, useEffect, useMemo } from 'react';
// FIX: Corrected import path for type definitions.
import type { Student, Mission, ShopItem, SidebarTab, Transaction, ShopSettings, ShopCategory, ShopSortKey, Coupon, GroupSettings, GeneralSettings, SpecialMission } from '../types';
import { ConfirmationModal, ActionButton } from './modals/ConfirmationModal';


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
    onClose: () => void;
    onAddTransaction: (studentId: string, type: Transaction['type'], description: string, amount: number, eventDetails?: { eventMonth: string }) => void;
    onUpdateTransaction: (transaction: Transaction) => void;
    onDeleteCoupon: (couponId: string) => void;
    onPurchase: (studentId: string, description: string, totalCost: number, couponDeduction: number, finalStoneCost: number) => void;
    onCancelTransaction: (transactionId: string) => void;
    onDeleteTransaction: (transactionId: string) => void;
    onTransferStones: (fromStudentId: string, toStudentId: string, amount: number) => void;
    onUpdateJosekiProgress: (studentId: string, progress: number) => void;
    onCompleteJosekiMission: (studentId: string) => void;
}

export const QuickMenuSidebar = (props: QuickMenuSidebarProps) => {
    const { 
        student, students, missions, specialMissions, shopItems, shopSettings, shopCategories, coupons, transactions, 
        isOpen, groupSettings, generalSettings, onClose, onAddTransaction, onUpdateTransaction, 
        onDeleteCoupon, onPurchase, onCancelTransaction, onDeleteTransaction, onTransferStones, 
        onUpdateJosekiProgress, onCompleteJosekiMission
    } = props;

    const [activeTab, setActiveTab] = useState<SidebarTab>('missions');
    const [sendAmount, setSendAmount] = useState('');
    const [sendReason, setSendReason] = useState('');
    const [transferAmount, setTransferAmount] = useState('');
    const [recipientId, setRecipientId] = useState('');
    const [josekiInput, setJosekiInput] = useState('1');

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

    useEffect(() => {
        if (student) {
            setJosekiInput(String(student.josekiProgress || 1));
        }
        if (!isOpen) {
            // Reset fields when sidebar closes
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
        }
    }, [isOpen, student]);

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

        onAddTransaction(student.id, 'mission', `${partialMission.description} (부분 점수)`, amount);
        
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
        alert('감점이 적용되었습니다.');
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
    };

    const handleCompleteJoseki = () => {
        if (!student) return;
        onCompleteJosekiMission(student.id);
    };

    // --- Special Mission Logic ---
    const dailySpecialMission = useMemo(() => {
        if (!student) return null;
        const available = specialMissions.filter(m => m.group === student.group);
        if (available.length === 0) return null;

        // Seeded random based on student ID and today's date string
        const today = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).split(' ')[0];
        const seed = student.id + today;
        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
            hash = ((hash << 5) - hash) + seed.charCodeAt(i);
            hash |= 0; // Convert to 32bit integer
        }
        const index = Math.abs(hash) % available.length;
        return available[index];
    }, [student, specialMissions]);

    const isSpecialMissionCompletedToday = useMemo(() => {
        if (!student) return false;
        const todayStrInKST = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).split(' ')[0];
        return transactions.some(t => 
            t.studentId === student.id && 
            t.type === 'special_mission' && 
            new Date(t.timestamp).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).startsWith(todayStrInKST) && 
            t.status === 'active'
        );
    }, [student, transactions]);

    const handleCompleteSpecialMission = () => {
        if (!student || !dailySpecialMission || isSpecialMissionCompletedToday) return;
        onAddTransaction(
            student.id, 
            'special_mission', 
            `[특별] ${dailySpecialMission.content}`, 
            dailySpecialMission.stones
        );
    };

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
        const total = totalAfterBulk - temporaryDiscount;
        const couponDeduction = Math.min(total, availableCouponValue);
        const finalStoneCost = total - couponDeduction;

        return { items, subtotal, totalQuantity, bulkDiscount, temporaryDiscount, total, couponDeduction, finalStoneCost };
    }, [cart, shopItems, shopSettings, availableCouponValue, tempDiscount]);
    
    const handleCheckout = () => {
        if (!student || cartDetails.items.length === 0) return;
        if (student.stones < cartDetails.finalStoneCost) {
            alert('스톤이 부족합니다!');
            return;
        }

        const description = cartDetails.items.map(item => `${item.name} x${item.quantity}`).join(', ');
        // NEW: Pass cost breakdown for coupon consumption
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

    const studentMissions = useMemo(() => {
        if (!student) return [];
        const attendanceMission: Mission = { id: 'attendance_mission', description: '출석', stones: generalSettings.attendanceStoneValue, group: student.group, type: 'attendance' };
        
        // Add special mission to the list if available
        const list: any[] = [attendanceMission];
        
        if (dailySpecialMission) {
            list.push({
                id: 'daily_special_mission',
                description: dailySpecialMission.content,
                stones: dailySpecialMission.stones,
                stars: dailySpecialMission.stars,
                isSpecial: true
            });
        }

        const groupMissions = missions.filter(m => m.group === student.group);
        return [...list, ...groupMissions];
    }, [student, missions, generalSettings.attendanceStoneValue, dailySpecialMission]);

    const missionCompletionCounts = useMemo(() => {
        if (!student) return new Map<string, number>();
        const todayStrInKST = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).split(' ')[0];
        const counts = new Map<string, number>();
        transactions.filter(t => t.studentId === student.id && new Date(t.timestamp).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).startsWith(todayStrInKST)).forEach(t => {
            if (t.type === 'mission' || t.type === 'attendance' || t.type === 'special_mission') {
                let desc = t.description.replace(' (부분 점수)', '').replace('[특별] ', '');
                counts.set(desc, (counts.get(desc) || 0) + 1);
            }
        });
        return counts;
    }, [student, transactions]);

    const sortedTransactions = useMemo(() => {
        if (!student) return [];
        return transactions.filter(t => t.studentId === student.id).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [transactions, student]);

    return (
        <>
        <div className={`quick-menu-sidebar ${isOpen ? 'open' : ''}`}>
            {student && (
                <>
                    <div className="sidebar-header">
                        <button className="close-btn" onClick={onClose} aria-label="닫기">&times;</button>
                        <h2>{student.name}</h2>
                        <p>{student.rank} ({groupSettings[student.group]?.name || student.group})</p>
                        <p className="stones">{student.stones} / {student.maxStones} 스톤</p>
                    </div>
                    <div className="sidebar-tabs">
                        <button className={`tab-item ${activeTab === 'missions' ? 'active' : ''}`} onClick={() => setActiveTab('missions')}>오늘의 미션</button>
                        <button className={`tab-item ${activeTab === 'shop' ? 'active' : ''}`} onClick={() => setActiveTab('shop')}>상점</button>
                        <button className={`tab-item ${activeTab === 'coupons' ? 'active' : ''}`} onClick={() => setActiveTab('coupons')}>쿠폰함</button>
                        <button className={`tab-item ${activeTab === 'send' ? 'active' : ''}`} onClick={() => setActiveTab('send')}>스톤 관리</button>
                        <button className={`tab-item ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>활동 기록</button>
                    </div>
                    <div className={`sidebar-content ${activeTab === 'shop' ? 'shop-mode' : ''}`}>
                        {activeTab === 'missions' && (
                           <>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem', marginBottom: '1.5rem'}}>
                                    <div>
                                        <h3 style={{ fontSize: '1.1rem', color: 'var(--primary-color)', marginBottom: '0.8rem' }}>개인 연속 미션</h3>
                                        <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 0 }}>
                                            <label htmlFor="joseki-progress" style={{ marginBottom: 0, whiteSpace: 'nowrap', fontSize: '0.9rem' }}>No.</label>
                                            <input type="number" id="joseki-progress" value={josekiInput} onChange={e => setJosekiInput(e.target.value)} onBlur={handleUpdateJoseki} min="1" style={{ width: '50px', textAlign: 'center', padding: '0.3rem' }} />
                                            <button className="btn-sm" onClick={handleUpdateJoseki}>변경</button>
                                            <button className="btn-sm primary" onClick={handleCompleteJoseki} disabled={student.stones >= student.maxStones} style={{ marginLeft: 'auto' }} title={`완료시 +${generalSettings.josekiMissionValue} 스톤`}>완료</button>
                                        </div>
                                    </div>
                                    <div style={{ borderLeft: '1px solid #eee', paddingLeft: '1.5rem' }}>
                                        <h3 style={{ fontSize: '1.1rem', color: 'var(--danger-color)', marginBottom: '0.8rem' }}>예절 불량 감점</h3>
                                        <form onSubmit={handleApplyPenalty} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <input type="number" placeholder="점수" value={penaltyAmount} onChange={e => setPenaltyAmount(e.target.value)} min="1" style={{ width: '80px', padding: '0.4rem', border: '1px solid #ddd', borderRadius: '4px' }} />
                                            <button type="submit" className="btn-sm danger" style={{whiteSpace: 'nowrap'}}>적용</button>
                                        </form>
                                    </div>
                                </div>

                                <h3 style={{fontSize: '1.2rem', marginBottom: '1rem'}}>오늘의 미션</h3>
                                <ul className="mission-list">
                                    {studentMissions.map((mission: any) => {
                                        const isSpecial = mission.isSpecial;
                                        const completionsToday = missionCompletionCounts.get(mission.description) || 0;
                                        const isCompleted = isSpecial ? isSpecialMissionCompletedToday : false;

                                        return (
                                            <li key={mission.id} className={`mission-item ${isSpecial ? 'special-item' : ''}`}>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                                                    <span style={{ fontWeight: 500, color: isSpecial ? 'var(--accent-color)' : 'inherit' }}>
                                                        {isSpecial ? `[특별] ${mission.description}` : mission.description}
                                                    </span>
                                                    {isSpecial && (
                                                        <span style={{ fontSize: '0.75rem', color: '#888', marginTop: '2px' }}>
                                                            {'★'.repeat(mission.stars)}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="mission-actions">
                                                    {!isSpecial && completionsToday > 0 && (
                                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-color-secondary)' }}>({completionsToday}회)</span>
                                                    )}
                                                    <span className="mission-stones">+{mission.stones}</span>
                                                    
                                                    {isSpecial ? (
                                                        <button 
                                                            className={`btn-sm ${isCompleted ? 'success' : 'primary'}`} 
                                                            onClick={handleCompleteSpecialMission} 
                                                            disabled={isCompleted || student.stones >= student.maxStones}
                                                        >
                                                            {isCompleted ? '완료됨' : '완료'}
                                                        </button>
                                                    ) : (
                                                        <>
                                                            {mission.type !== 'attendance' && (
                                                                <button className="btn-sm" onClick={() => handleOpenPartialMissionModal(mission)} disabled={student.stones >= student.maxStones}>부분</button>
                                                            )}
                                                            <button className="btn-sm primary" onClick={() => handleMissionComplete(mission)} disabled={student.stones >= student.maxStones}>완료</button>
                                                        </>
                                                    )}
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
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
                                                    <select id="shop-sort" value={shopSortKey} onChange={e => setShopSortKey(e.target.value as ShopSortKey)}>
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
                                        ) : <div style={{textAlign: 'center', padding: '2rem 0', color: 'var(--text-color-secondary)'}}><p>장바구니가 비었습니다.</p></div>}
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
                                            <div className="final-total"><span>최종 결제</span><span>{cartDetails.finalStoneCost} 스톤</span></div>
                                        </div>
                                        <button className="btn primary cart-checkout-btn" onClick={handleCheckout} disabled={student.stones < cartDetails.finalStoneCost || cartDetails.items.length === 0}>{cartDetails.finalStoneCost} 스톤으로 결제</button>
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
                            <div>
                                <form className="send-stone-form" onSubmit={handleSendStones}>
                                    <h3>스톤 수동 지급/차감</h3>
                                    <div className="form-group"><label htmlFor="sendAmount">지급/차감할 스톤</label><input type="number" id="sendAmount" value={sendAmount} onChange={e => setSendAmount(e.target.value)} placeholder="0" /><small>양수는 지급, 음수는 차감입니다.</small></div>
                                    <div className="form-group"><label htmlFor="sendReason">사유</label><input type="text" id="sendReason" value={sendReason} onChange={e => setSendReason(e.target.value)} placeholder="예: 착한 일을 해서 스톤 지급" /></div>
                                    <button type="submit" className="btn primary">적용</button>
                                </form>
                                <div className="stone-transfer-form">
                                    <h3>학생에게 스톤 보내기</h3>
                                    <form onSubmit={handleTransfer}>
                                        <div className="form-group">
                                            <label htmlFor="recipient">받는 학생</label>
                                            <select id="recipient" value={recipientId} onChange={e => setRecipientId(e.target.value)} required>
                                                <option value="" disabled>학생 선택...</option>
                                                {students.filter(s => s.id !== student.id && s.status === '재원').sort((a,b) => a.name.localeCompare(b.name)).map(s => <option key={s.id} value={s.id}>{s.name} ({s.rank})</option>)}
                                            </select>
                                        </div>
                                        <div className="form-group"><label htmlFor="transferAmount">보낼 스톤</label><input type="number" id="transferAmount" value={transferAmount} onChange={e => setTransferAmount(e.target.value)} min="1" max={student.stones} required placeholder="0" /></div>
                                        <button type="submit" className="btn primary" disabled={(parseInt(transferAmount, 10) || 0) <= 0 || !recipientId || student.stones < (parseInt(transferAmount, 10) || 0)}>보내기</button>
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
                                                <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>활동 기록이 없습니다.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
         {transactionToCancel && <ConfirmationModal message={`'${transactionToCancel.description}' 내역을 정말 취소하시겠습니까? (${-transactionToCancel.amount} 스톤이 복구됩니다)`} actions={[{ text: '닫기', onClick: () => setTransactionToCancel(null) }, { text: '취소 실행', onClick: () => { onCancelTransaction(transactionToCancel.id); setTransactionToCancel(null); }}]} onClose={() => setTransactionToCancel(null)} />}
        {transactionToDelete && <ConfirmationModal message={`'${transactionToDelete.description}' 내역을 정말 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없으며, 학생의 스톤이 변동됩니다.`} actions={[{ text: '닫기', onClick: () => setTransactionToDelete(null) }, { text: '삭제 실행', className: 'danger', onClick: () => { onDeleteTransaction(transactionToDelete.id); setTransactionToDelete(null); }}]} onClose={() => setTransactionToDelete(null)} />}
        {partialMission && (
            <div className="modal-overlay" onClick={() => setPartialMission(null)}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                    <h2>부분 점수 지급</h2>
                    <form onSubmit={handlePartialMissionSubmit}>
                        <div className="form-group"><label>미션</label><p style={{ fontWeight: '500', padding: '0.5rem', background: 'var(--bg-color)', borderRadius: '4px' }}>{partialMission.description}</p></div>
                        <div className="form-group"><label htmlFor="partial-amount">지급할 스톤 (최대 {partialMission.stones})</label><input type="number" id="partial-amount" value={partialAmount} onChange={(e) => setPartialAmount(e.target.value)} min="1" max={partialMission.stones} required autoFocus placeholder="점수 입력" /></div>
                        <div className="modal-actions"><button type="button" className="btn" onClick={() => setPartialMission(null)}>취소</button><button type="submit" className="btn primary">지급</button></div>
                    </form>
                </div>
            </div>
        )}
        </>
    );
};
