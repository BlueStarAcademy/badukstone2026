
import React, { useState, useMemo, useRef, useEffect } from 'react';
// FIX: Corrected import path for type definitions.
import type { Student, Mission, ShopItem, AdminTab, ShopSettings, Coupon, GroupSettings, GeneralSettings, ShopCategory, AppData, SpecialMission, PersonalMissionTemplate, PersonalMissionType } from '../types';
import { generateId, parseRank } from '../utils';
import { exportDataToExcel, importDataFromExcel } from '../utils/excelUtils';
import { StudentFormModal } from './modals/StudentFormModal';
import { MissionFormModal } from './modals/MissionFormModal';
import { ShopItemFormModal } from './modals/ShopItemFormModal';
import { ConfirmationModal, ActionButton } from './modals/ConfirmationModal';
import { BulkStoneAwardModal } from './modals/BulkStoneAwardModal';
import { CouponFormModal } from './modals/CouponFormModal';
import { GroupSettingsModal } from './modals/GroupSettingsModal';
import { ShopSettingsModal } from './modals/ShopSettingsModal';
import { SpecialMissionManagerModal } from './modals/SpecialMissionManagerModal';
import { PersonalMissionTemplateModal } from './modals/PersonalMissionTemplateModal';
import { AssignPersonalMissionModal } from './modals/AssignPersonalMissionModal';

type StudentStatus = '재원' | '휴원';

interface BulkAllStudentsAwardModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAward: (details: { amount: number; description: string; statuses: StudentStatus[] }) => void;
}

const BulkAllStudentsAwardModal = ({ isOpen, onClose, onAward }: BulkAllStudentsAwardModalProps) => {
    const [amount, setAmount] = useState(0);
    const [description, setDescription] = useState('');
    const [statuses, setStatuses] = useState<Set<StudentStatus>>(new Set(['재원']));

    useEffect(() => {
        if (isOpen) {
            setAmount(0);
            setDescription('');
            setStatuses(new Set(['재원']));
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleStatusChange = (status: StudentStatus, checked: boolean) => {
        setStatuses(prev => {
            const newSet = new Set(prev);
            if (checked) {
                newSet.add(status);
            } else {
                newSet.delete(status);
            }
            return newSet;
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!description.trim()) {
            alert('사유를 입력해주세요.');
            return;
        }
        if (statuses.size === 0) {
            alert('지급 대상을 선택해주세요.');
            return;
        }
        onAward({ amount, description, statuses: Array.from(statuses) });
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h2>전체 학생 스톤 지급/차감</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>지급 대상</label>
                        <div style={{ display: 'flex', gap: '1rem', padding: '0.5rem 0' }}>
                            <div className="form-group-checkbox">
                                <input
                                    type="checkbox"
                                    id="status-active"
                                    checked={statuses.has('재원')}
                                    onChange={(e) => handleStatusChange('재원', e.target.checked)}
                                />
                                <label htmlFor="status-active">재원생</label>
                            </div>
                            <div className="form-group-checkbox">
                                <input
                                    type="checkbox"
                                    id="status-inactive"
                                    checked={statuses.has('휴원')}
                                    onChange={(e) => handleStatusChange('휴원', e.target.checked)}
                                />
                                <label htmlFor="status-inactive">휴원생</label>
                            </div>
                        </div>
                    </div>
                    <div className="form-group">
                        <label htmlFor="bulk-all-amount">스톤 개수</label>
                        <input
                            type="number"
                            id="bulk-all-amount"
                            value={amount}
                            onChange={(e) => setAmount(parseInt(e.target.value, 10) || 0)}
                            placeholder="양수는 지급, 음수는 차감"
                            required
                        />
                         <small>양수는 지급, 음수는 차감입니다.</small>
                    </div>
                    <div className="form-group">
                        <label htmlFor="bulk-all-description">사유</label>
                        <input
                            type="text"
                            id="bulk-all-description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="예: 새해맞이 스톤 지급"
                            required
                        />
                    </div>
                    <div className="modal-actions">
                        <button type="button" className="btn" onClick={onClose}>취소</button>
                        <button type="submit" className="btn primary">적용</button>
                    </div>
                </form>
            </div>
        </div>
    );
};
interface AdminPanelProps {
    students: Student[];
    missions: Mission[];
    chessMissions: Mission[];
    specialMissions: SpecialMission[];
    personalMissionTemplates: PersonalMissionTemplate[];
    onUpsertPersonalMissionTemplate: (template: PersonalMissionTemplate) => void;
    onDeletePersonalMissionTemplate: (templateId: string) => void;
    onBulkAddPersonalMission: (
        studentIds: string[],
        mission: { title: string; stones: number; no: number; missionType?: PersonalMissionType }
    ) => void;
    shopItems: ShopItem[];
    shopSettings: ShopSettings;
    shopCategories: ShopCategory[];
    groupSettings: GroupSettings;
    generalSettings: GeneralSettings;
    setMissions: React.Dispatch<React.SetStateAction<Mission[]>>;
    setChessMissions: React.Dispatch<React.SetStateAction<Mission[]>>;
    setSpecialMissions: React.Dispatch<React.SetStateAction<SpecialMission[]>>;
    setShopItems: React.Dispatch<React.SetStateAction<ShopItem[]>>;
    setShopSettings: React.Dispatch<React.SetStateAction<ShopSettings>>;
    setShopCategories: React.Dispatch<React.SetStateAction<ShopCategory[]>>;
    onSaveStudent: (studentData: Omit<Student, 'id' | 'group' | 'maxStones' | 'stones' | 'chessRating'>, studentIdToEdit: string | null) => void;
    onDeleteStudent: (studentId: string) => void;
    onUpdateGroupSettings: (newSettings: GroupSettings) => void;
    onUpdateGeneralSettings: (newSettings: GeneralSettings) => void;
    onBulkAddTransaction: (studentIds: string[], description: string, amount: number) => void;
    onBulkUpdateStudents: (studentIds: string[], updates: { rank?: string; status?: Student['status'] }) => void;
    // FIX: Removed duplicate onAddCoupon identifier
    onAddCoupon: (couponData: Omit<Coupon, 'id'>) => void;
    onImportStudents: (data: (Omit<Student, 'id' | 'group' | 'maxStones'> & { stones?: number })[], mode: 'replace' | 'add') => void;
    onImportMissions: (data: Omit<Mission, 'id'>[], mode: 'replace' | 'add') => void;
    onImportShopItems: (data: Omit<ShopItem, 'id'>[], mode: 'replace' | 'add') => void;
}

const DragHandle = () => (
    <svg className="drag-handle" width="24" height="24" viewBox="0 0 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M9 4V6m0 2V10m0 2v2m0 2v2m6-12V6m0 2V10m0 2v2m0 2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

const STUDENT_HEADER_MAP = { name: '이름', rank: '급수/단', stones: '보유 스톤', status: '상태', birthday: '생일(MM-DD)', takesChess: '체스수업(TRUE/FALSE)', chessRating: '체스레이팅' };
const MISSION_HEADER_MAP = { description: '미션 내용', stones: '보상 스톤', group: '대상 그룹' };
const SHOP_ITEM_HEADER_MAP = { name: '상품명', price: '가격', category: '카테고리' };


export const AdminPanel = (props: AdminPanelProps) => {
    const { 
        students, missions, chessMissions, specialMissions, personalMissionTemplates, onUpsertPersonalMissionTemplate, onDeletePersonalMissionTemplate, onBulkAddPersonalMission, shopItems, shopSettings, shopCategories, groupSettings, generalSettings,
        setMissions, setChessMissions, setSpecialMissions, setShopItems, setShopSettings, setShopCategories,
        onSaveStudent, onDeleteStudent, onUpdateGroupSettings, onUpdateGeneralSettings,
        onBulkAddTransaction, onBulkUpdateStudents, onAddCoupon,
        onImportStudents, onImportMissions, onImportShopItems,
    } = props;

    const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
    const [studentToEdit, setStudentToEdit] = useState<Student | null>(null);
    const [isMissionModalOpen, setIsMissionModalOpen] = useState(false);
    const [missionToEdit, setMissionToEdit] = useState<Mission | null>(null);
    const [isShopItemModalOpen, setIsShopItemModalOpen] = useState(false);
    const [itemToEdit, setItemToEdit] = useState<{item: ShopItem | null, category?: string}>({item: null});
    const [isBulkAwardModalOpen, setIsBulkAwardModalOpen] = useState(false);
    const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
    const [studentForCoupon, setStudentForCoupon] = useState<Student | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isBulkAllStudentsAwardModalOpen, setIsBulkAllStudentsAwardModalOpen] = useState(false);
    const [missionTypeToAdd, setMissionTypeToAdd] = useState<'group' | 'chess'>('group');

    const [isGroupSettingsModalOpen, setIsGroupSettingsModalOpen] = useState(false);
    const [isShopSettingsModalOpen, setIsShopSettingsModalOpen] = useState(false);
    const [isSpecialMissionModalOpen, setIsSpecialMissionModalOpen] = useState(false);
    const [isPersonalMissionTemplateModalOpen, setIsPersonalMissionTemplateModalOpen] = useState(false);
    const [isAssignPersonalMissionModalOpen, setIsAssignPersonalMissionModalOpen] = useState(false);
    const [personalMissionInitialStudentIds, setPersonalMissionInitialStudentIds] = useState<string[]>([]);

    const [confirmation, setConfirmation] = useState<{ message: React.ReactNode; actions: ActionButton[] } | null>(null);
    
    const [activeTab, setActiveTab] = useState<AdminTab>('students');
    const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
    
    const [draggedMissionId, setDraggedMissionId] = useState<string | null>(null);
    
    const groups = useMemo(() => generalSettings.groupOrder.filter(g => groupSettings[g]), [generalSettings.groupOrder, groupSettings]);

    const [activeStudentGroup, setActiveStudentGroup] = useState('전체');
    const [studentSearchTerm, setStudentSearchTerm] = useState('');
    const [bulkEditRank, setBulkEditRank] = useState('');
    const [bulkEditStatus, setBulkEditStatus] = useState<Student['status'] | ''>('');


    const missionsByGroup = useMemo(() => {
        return missions.reduce((acc, mission) => {
            if (mission.group) {
                (acc[mission.group] = acc[mission.group] || []).push(mission);
            }
            return acc;
        }, {} as Record<string, Mission[]>);
    }, [missions]);

    const shopItemsByCategory = useMemo(() => {
        return shopItems.reduce((acc, item) => {
            (acc[item.category] = acc[item.category] || []).push(item);
            return acc;
        }, {} as Record<string, ShopItem[]>);
    }, [shopItems]);
    
    const rankOptions = useMemo(() => ['입문']
        .concat(Array.from({ length: 30 }, (_, i) => `${30 - i}급`))
        .concat(Array.from({ length: 9 }, (_, i) => `${i + 1}단`)), []);


    const studentsInCurrentTab = useMemo(() => {
        let filtered = students;

        if (activeStudentGroup !== '전체') {
            filtered = filtered.filter(s => s.group === activeStudentGroup);
        }

        if (studentSearchTerm.trim() !== '') {
            filtered = filtered.filter(s =>
                s.name.toLowerCase().includes(studentSearchTerm.trim().toLowerCase())
            );
        }
        
        return filtered.sort((a,b) => parseRank(b.rank) - parseRank(a.rank));
    }, [students, activeStudentGroup, studentSearchTerm]);

    useEffect(() => {
        setSelectedStudentIds(new Set());
    }, [activeTab, activeStudentGroup]);

    const handleSaveStudent = (studentData: Omit<Student, 'id' | 'group' | 'maxStones' | 'stones' | 'chessRating'>) => {
        onSaveStudent(studentData, studentToEdit ? studentToEdit.id : null);
        setIsStudentModalOpen(false);
        setStudentToEdit(null);
    };

    const handleDeleteStudent = (id: string) => {
         setConfirmation({
            message: '정말 이 학생을 삭제하시겠습니까? 모든 활동 기록이 함께 삭제됩니다.',
            actions: [
                { text: '취소', onClick: () => setConfirmation(null) },
                { text: '삭제', className: 'danger', onClick: () => {
                    onDeleteStudent(id);
                    setConfirmation(null);
                }}
            ]
        });
    };
    
    const handleSaveMission = (missionData: Omit<Mission, 'id'>) => {
        if (missionToEdit) {
            if (missionToEdit.group) {
                 setMissions(prev => prev.map(m => m.id === missionToEdit.id ? { ...m, ...missionData } : m));
            } else {
                 setChessMissions(prev => prev.map(m => m.id === missionToEdit.id ? { ...m, ...missionData } : m));
            }
        } else {
            if (missionTypeToAdd === 'chess') {
                const { group, ...rest } = missionData as Mission;
                setChessMissions(prev => [...prev, { ...rest, id: generateId() }]);
            } else {
                setMissions(prev => [...prev, { ...missionData, id: generateId() }]);
            }
        }
        setIsMissionModalOpen(false);
        setMissionToEdit(null);
    };

    const handleDeleteMission = (id: string, isChess: boolean) => {
        setConfirmation({
            message: '정말 이 미션을 삭제하시겠습니까?',
            actions: [
                { text: '취소', onClick: () => setConfirmation(null) },
                { text: '삭제', className: 'danger', onClick: () => {
                    if (isChess) {
                        setChessMissions(prev => prev.filter(m => m.id !== id));
                    } else {
                        setMissions(prev => prev.filter(m => m.id !== id));
                    }
                    setConfirmation(null);
                }}
            ]
        });
    };

    const handleSaveShopItem = (itemData: Omit<ShopItem, 'id'>) => {
        if (itemToEdit.item) {
            setShopItems(prev => prev.map(item => item.id === itemToEdit.item!.id ? { ...itemToEdit.item!, ...itemData } : item));
        } else {
            setShopItems(prev => [...prev, { ...itemData, id: generateId() }]);
        }
        setIsShopItemModalOpen(false);
        setItemToEdit({item: null});
    };

    const handleDeleteShopItem = (id: string) => {
        setConfirmation({
            message: '정말 이 상품을 삭제하시겠습니까?',
            actions: [
                { text: '취소', onClick: () => setConfirmation(null) },
                { text: '삭제', className: 'danger', onClick: () => {
                    setShopItems(prev => prev.filter(item => item.id !== id));
                    setConfirmation(null);
                }}
            ]
        });
    };
    
    const handleSelectStudent = (id: string) => {
        setSelectedStudentIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const handleSelectAllInTab = (e: React.ChangeEvent<HTMLInputElement>) => {
        const isSelected = e.target.checked;
        const studentIdsInTab = studentsInCurrentTab.map(s => s.id);

        if (isSelected) {
            setSelectedStudentIds(new Set(studentIdsInTab));
        } else {
            setSelectedStudentIds(new Set());
        }
    };
    
    const handleBulkAward = ({ amount, description }: { amount: number; description: string }) => {
        const studentCount = selectedStudentIds.size;
        setConfirmation({
            message: `선택된 ${studentCount}명의 학생에게 스톤 ${amount}개를 ${amount >= 0 ? '지급' : '차감'}하시겠습니까? 사유: ${description}`,
            actions: [
                { text: '취소', onClick: () => setConfirmation(null) },
                { text: '확인', className: 'primary', onClick: () => {
                    onBulkAddTransaction(Array.from(selectedStudentIds), description, amount);
                    setSelectedStudentIds(new Set());
                    setIsBulkAwardModalOpen(false);
                    setConfirmation(null);
                }}
            ]
        });
    };
    
    const handleBulkAwardToAll = ({ amount, description, statuses }: { amount: number; description: string; statuses: ('재원' | '휴원')[] }) => {
        const targetStudents = students.filter(s => statuses.includes(s.status));
        const studentIds = targetStudents.map(s => s.id);
        const studentCount = studentIds.length;

        if (studentCount === 0) {
            alert('지급 대상 학생이 없습니다.');
            return;
        }

        setConfirmation({
            message: `선택된 ${statuses.join(', ')} 학생 ${studentCount}명에게 스톤 ${amount}개를 ${amount >= 0 ? '지급' : '차감'}하시겠습니까? 사유: ${description}`,
            actions: [
                { text: '취소', onClick: () => setConfirmation(null) },
                { text: '확인', className: 'primary', onClick: () => {
                    onBulkAddTransaction(studentIds, description, amount);
                    setIsBulkAllStudentsAwardModalOpen(false);
                    setConfirmation(null);
                }}
            ]
        });
    };

    const handleApplyBulkEdit = () => {
        const updates: { rank?: string; status?: Student['status'] } = {};
        if (bulkEditRank) updates.rank = bulkEditRank;
        if (bulkEditStatus) updates.status = bulkEditStatus;

        if (Object.keys(updates).length === 0) {
            alert('변경할 항목을 선택해주세요.');
            return;
        }

        const rankText = updates.rank ? `급수를 '${updates.rank}'(으)로` : '';
        const statusText = updates.status ? `상태를 '${updates.status}'(으)로` : '';
        const message = `선택된 ${selectedStudentIds.size}명의 학생의 ${rankText}${rankText && statusText ? ' 그리고 ' : ''}${statusText} 변경하시겠습니까?`;

        setConfirmation({
            message,
            actions: [
                { text: '취소', onClick: () => setConfirmation(null) },
                { text: '적용', className: 'primary', onClick: () => {
                    onBulkUpdateStudents(Array.from(selectedStudentIds), updates);
                    setConfirmation(null);
                    setSelectedStudentIds(new Set());
                    setBulkEditRank('');
                    setBulkEditStatus('');
                }}
            ]
        })
    };
    
    const handleOpenCouponModal = (student: Student) => {
        setStudentForCoupon(student);
        setIsCouponModalOpen(true);
    };

    const openAssignPersonalMissionModal = (studentIds: string[] = []) => {
        setPersonalMissionInitialStudentIds(studentIds);
        setIsAssignPersonalMissionModalOpen(true);
    };

    const handleSaveCoupon = (couponFormData: Omit<Coupon, 'id' | 'studentId'>) => {
        if (studentForCoupon) {
            onAddCoupon({
                ...couponFormData,
                studentId: studentForCoupon.id,
            });
        }
        setIsCouponModalOpen(false);
        setStudentForCoupon(null);
    };

    // --- Excel Handlers ---
    const handleDownloadTemplate = () => {
        if (activeTab === 'students') exportDataToExcel([], '학생_업로드_양식', STUDENT_HEADER_MAP);
        else if (activeTab === 'missions') exportDataToExcel([], '미션_업로드_양식', MISSION_HEADER_MAP);
        else if (activeTab === 'shop') exportDataToExcel([], '상점_업로드_양식', SHOP_ITEM_HEADER_MAP);
    };

    const handleDownloadData = () => {
        if (activeTab === 'students') exportDataToExcel(students, '전체_학생_데이터', STUDENT_HEADER_MAP);
        else if (activeTab === 'missions') exportDataToExcel(missions, '전체_미션_데이터', MISSION_HEADER_MAP);
        else if (activeTab === 'shop') exportDataToExcel(shopItems, '전체_상점_데이터', SHOP_ITEM_HEADER_MAP);
    };
    
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            let data: any[], handler: (d: any[], m: 'replace' | 'add') => void;

            if (activeTab === 'students') {
                data = await importDataFromExcel(file, STUDENT_HEADER_MAP);
                handler = onImportStudents;
            } else if (activeTab === 'missions') {
                data = await importDataFromExcel(file, MISSION_HEADER_MAP);
                handler = onImportMissions;
            } else { // shop
                data = await importDataFromExcel(file, SHOP_ITEM_HEADER_MAP);
                handler = onImportShopItems;
            }

            setConfirmation({
                message: `${data.length}개의 데이터를 가져왔습니다. 어떻게 적용할까요?`,
                actions: [
                    { text: '취소', onClick: () => setConfirmation(null) },
                    { text: '추가하기', className: 'primary', onClick: () => { handler(data, 'add'); setConfirmation(null); } },
                    { text: '덮어쓰기', className: 'danger', onClick: () => { handler(data, 'replace'); setConfirmation(null); } },
                ]
            });

        } catch (error) {
            alert(`파일 처리 오류: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            // Reset file input to allow uploading the same file again
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // Drag and Drop Handlers
    const handleDragStart = (e: React.DragEvent<HTMLLIElement>, missionId: string) => {
        setDraggedMissionId(missionId);
        e.dataTransfer.effectAllowed = 'move';
        e.currentTarget.classList.add('dragging');
    };

    const handleDragOver = (e: React.DragEvent<HTMLLIElement>) => {
        e.preventDefault();
        e.currentTarget.classList.add('drag-over-indicator');
    };
    
    const handleDragLeave = (e: React.DragEvent<HTMLLIElement>) => {
        e.currentTarget.classList.remove('drag-over-indicator');
    };

    const handleDrop = (e: React.DragEvent<HTMLLIElement>, targetMissionId: string, isChess: boolean) => {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over-indicator');
        if (!draggedMissionId || draggedMissionId === targetMissionId) return;
    
        if (isChess) {
            const missionsCopy = [...chessMissions];
            const draggedIndex = missionsCopy.findIndex(m => m.id === draggedMissionId);
            const targetIndex = missionsCopy.findIndex(m => m.id === targetMissionId);

            if (draggedIndex === -1 || targetIndex === -1) {
                 setDraggedMissionId(null);
                 return;
            }

            const [draggedItem] = missionsCopy.splice(draggedIndex, 1);
            missionsCopy.splice(targetIndex, 0, draggedItem);
            setChessMissions(missionsCopy);
        } else {
            const missionsCopy = [...missions]; // Shallow copy is sufficient for reordering
            const draggedIndex = missionsCopy.findIndex((m: Mission) => m.id === draggedMissionId);
            const targetIndex = missionsCopy.findIndex((m: Mission) => m.id === targetMissionId);
            
            if (draggedIndex === -1 || targetIndex === -1 || missionsCopy[draggedIndex].group !== missionsCopy[targetIndex].group) {
                setDraggedMissionId(null);
                return;
            }
            
            const [draggedItem] = missionsCopy.splice(draggedIndex, 1);
            missionsCopy.splice(targetIndex, 0, draggedItem);
        
            setMissions(missionsCopy);
        }
        
        setDraggedMissionId(null);
    };

    const handleDragEnd = (e: React.DragEvent<HTMLLIElement>) => {
        e.currentTarget.classList.remove('dragging');
        setDraggedMissionId(null);
    };


    const areAllInTabSelected = useMemo(() => {
        const studentIdsInTab = studentsInCurrentTab.map(s => s.id);
        if (studentIdsInTab.length === 0) return false;
        return studentIdsInTab.every(id => selectedStudentIds.has(id));
    }, [studentsInCurrentTab, selectedStudentIds]);

    const templateButtonText = {
        students: "명단양식(Excel)다운로드",
        missions: "미션양식(Excel)다운로드",
        shop: "상품양식(Excel)다운로드"
    }[activeTab];

    const downloadButtonText = {
        students: "학생명단(Excel)다운로드",
        missions: "미션목록(Excel)다운로드",
        shop: "상품목록(Excel)다운로드"
    }[activeTab];

    const uploadButtonText = {
        students: "학생업로드(Excel)",
        missions: "미션업로드(Excel)",
        shop: "상품업로드(Excel)"
    }[activeTab];

    return (
        <div className="admin-panel">
            <div className="admin-controls">
                 <div className="view-toggle">
                    <button className={`toggle-btn ${activeTab === 'students' ? 'active' : ''}`} onClick={() => setActiveTab('students')}>학생</button>
                    <button className={`toggle-btn ${activeTab === 'missions' ? 'active' : ''}`} onClick={() => setActiveTab('missions')}>미션</button>
                    <button className={`toggle-btn ${activeTab === 'shop' ? 'active' : ''}`} onClick={() => setActiveTab('shop')}>상점</button>
                </div>
                <div className="controls-group">
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} accept=".xlsx, .xls, .csv" />
                    <button className="btn" onClick={handleDownloadTemplate} >{templateButtonText}</button>
                    <button className="btn" onClick={handleDownloadData} >{downloadButtonText}</button>
                    <button className="btn" onClick={() => fileInputRef.current?.click()} >{uploadButtonText}</button>
                    {activeTab === 'students' && (
                        <button className="btn primary" onClick={() => {
                            setStudentToEdit(null);
                            setIsStudentModalOpen(true);
                        }}>학생 추가</button>
                    )}
                </div>
            </div>

            {activeTab === 'students' && (
                <>
                    <div className="admin-header-actions">
                         <button className="btn primary" onClick={() => setIsBulkAllStudentsAwardModalOpen(true)}>💎 전체 스톤 지급</button>
                         <button className="btn" onClick={() => setIsGroupSettingsModalOpen(true)}>⚙️ 그룹 및 일반 설정</button>
                    </div>

                    <div className="view-toggle">
                        {['전체', ...groups].map(group => (
                            <button
                                key={group}
                                className={`toggle-btn ${activeStudentGroup === group ? 'active' : ''}`}
                                onClick={() => setActiveStudentGroup(group)}
                            >
                                {group === '전체' ? '전체' : (groupSettings[group]?.name || group)}
                            </button>
                        ))}
                    </div>

                    <div className="form-group" style={{ margin: '1rem 0' }}>
                        <input
                            type="text"
                            placeholder="학생 이름으로 검색..."
                            value={studentSearchTerm}
                            onChange={(e) => setStudentSearchTerm(e.target.value)}
                            className="search-input"
                            style={{ width: '100%' }}
                        />
                    </div>

                    {selectedStudentIds.size > 0 && (
                        <div className="bulk-actions-bar">
                            <p>{selectedStudentIds.size}명 선택됨</p>
                            <div className="bulk-actions-controls">
                                <button className="btn" onClick={() => setIsBulkAwardModalOpen(true)}>스톤 지급/차감</button>
                                <button className="btn" onClick={() => openAssignPersonalMissionModal(Array.from(selectedStudentIds))}>개인미션 부여</button>
                                <select value={bulkEditRank} onChange={e => setBulkEditRank(e.target.value)}>
                                    <option value="">급수 변경</option>
                                    {rankOptions.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                                <select value={bulkEditStatus} onChange={e => setBulkEditStatus(e.target.value as Student['status'] | '')}>
                                    <option value="">상태 변경</option>
                                    <option value="재원">재원</option>
                                    <option value="휴원">휴원</option>
                                </select>
                                <button className="btn primary" onClick={handleApplyBulkEdit}>적용</button>
                            </div>
                        </div>
                    )}
                    <table className="student-table">
                        <thead>
                            <tr>
                                <th className="checkbox-cell">
                                    <input
                                        type="checkbox"
                                        checked={areAllInTabSelected}
                                        onChange={handleSelectAllInTab}
                                        title={`${activeStudentGroup} 전체 선택`}
                                    />
                                </th>
                                {activeStudentGroup === '전체' && <th>그룹</th>}
                                <th>이름</th><th>급수/단</th><th>스톤</th><th>상태</th><th>생일</th><th>작업</th>
                            </tr>
                        </thead>
                        <tbody>
                            {studentsInCurrentTab.map(s => (
                                <tr key={s.id}>
                                    <td className="checkbox-cell" data-label="선택">
                                        <input type="checkbox" checked={selectedStudentIds.has(s.id)} onChange={() => handleSelectStudent(s.id)} />
                                    </td>
                                    {activeStudentGroup === '전체' && <td data-label="그룹">{groupSettings[s.group]?.name || s.group}</td>}
                                    <td className="student-name-cell" data-label="이름">
                                        {s.name}
                                        {s.takesChess && <span title="체스 수업 수강" className="chess-icon">♘</span>}
                                    </td>
                                    <td data-label="급수/단">{s.rank}</td>
                                    <td data-label="스톤">{s.stones} / {s.maxStones}</td>
                                    <td data-label="상태">{s.status}</td>
                                    <td data-label="생일">{s.birthday}</td>
                                    <td data-label="작업" className="actions">
                                        <button className="btn-sm" onClick={() => { setStudentToEdit(s); setIsStudentModalOpen(true); }}>수정</button>
                                        <button className="btn-sm" onClick={() => handleOpenCouponModal(s)}>쿠폰 발급</button>
                                        <button className="btn-sm danger" onClick={() => handleDeleteStudent(s.id)}>삭제</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </>
            )}
            
            {activeTab === 'missions' && (
                <>
                    <div className="view-header-actions mission-admin-header">
                        <div className="mission-admin-heading">
                            <h2>미션 관리</h2>
                            <p>단체·특별·개인미션을 목적에 맞게 설정합니다.</p>
                        </div>
                        <div className="mission-admin-toolbar">
                            <button className="btn-sm" onClick={() => setIsSpecialMissionModalOpen(true)}>특별 미션</button>
                            <button className="btn-sm" onClick={() => setIsPersonalMissionTemplateModalOpen(true)}>공통 개인미션</button>
                            <button className="btn-sm primary" onClick={() => openAssignPersonalMissionModal()}>학생별 미션 부여</button>
                        </div>
                    </div>

                    <div className="admin-grid-layout">
                        {groups.map(group => (
                            <div key={group} className="grid-card-item">
                                <div className="grid-card-header">
                                    <h3>{groupSettings[group]?.name || group}</h3>
                                    <button className="btn-xs primary" onClick={() => {
                                        setMissionToEdit(null);
                                        setMissionTypeToAdd('group');
                                        setIsMissionModalOpen(true);
                                    }}>+ 추가</button>
                                </div>
                                <div className="grid-card-body">
                                    {(missionsByGroup[group] && missionsByGroup[group].length > 0) ? (
                                        <ul className="compact-item-list">
                                            {missionsByGroup[group].map(m => (
                                                <li key={m.id} 
                                                    className="compact-item-row"
                                                    draggable
                                                    onDragStart={(e) => handleDragStart(e, m.id)}
                                                    onDragOver={handleDragOver}
                                                    onDragLeave={handleDragLeave}
                                                    onDrop={(e) => handleDrop(e, m.id, false)}
                                                    onDragEnd={handleDragEnd}
                                                >
                                                    <span className="drag-handle-mini"><DragHandle /></span>
                                                    <div className="item-main-info">
                                                        <span className="item-desc">{m.description}</span>
                                                        <span className="item-stones">+{m.stones} 스톤</span>
                                                    </div>
                                                    <div className="item-row-actions">
                                                        <button className="icon-btn" onClick={() => { setMissionToEdit(m); setIsMissionModalOpen(true); }}>✎</button>
                                                        <button className="icon-btn danger" onClick={() => handleDeleteMission(m.id, false)}>×</button>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <div className="empty-state-mini">미션이 없습니다.</div>
                                    )}
                                </div>
                            </div>
                        ))}

                        <div className="grid-card-item chess-special">
                            <div className="grid-card-header">
                                <h3>체스반 미션</h3>
                                <button className="btn-xs primary" onClick={() => {
                                    setMissionToEdit(null);
                                    setMissionTypeToAdd('chess');
                                    setIsMissionModalOpen(true);
                                }}>+ 추가</button>
                            </div>
                            <div className="grid-card-body">
                                {chessMissions.length > 0 ? (
                                    <ul className="compact-item-list">
                                        {chessMissions.map(m => (
                                            <li key={m.id} 
                                                className="compact-item-row"
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, m.id)}
                                                onDragOver={handleDragOver}
                                                onDragLeave={handleDragLeave}
                                                onDrop={(e) => handleDrop(e, m.id, true)}
                                                onDragEnd={handleDragEnd}
                                            >
                                                <span className="drag-handle-mini"><DragHandle /></span>
                                                <div className="item-main-info">
                                                    <span className="item-desc">{m.description}</span>
                                                    <span className="item-stones">+{m.stones} 스톤</span>
                                                </div>
                                                <div className="item-row-actions">
                                                    <button className="icon-btn" onClick={() => { setMissionToEdit(m); setIsMissionModalOpen(true); }}>✎</button>
                                                    <button className="icon-btn danger" onClick={() => handleDeleteMission(m.id, true)}>×</button>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="empty-state-mini">체스 미션이 없습니다.</div>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}
            
            {activeTab === 'shop' && (
                <>
                    <div className="view-header-actions" style={{ marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <h2 style={{ margin: 0 }}>상점 상품 관리</h2>
                            <button className="btn-sm" onClick={() => setIsShopSettingsModalOpen(true)}>⚙️ 상점 설정</button>
                        </div>
                    </div>

                    <div className="admin-grid-layout">
                        {shopCategories.map(category => (
                            <div key={category} className="grid-card-item">
                                <div className="grid-card-header">
                                    <h3>{category}</h3>
                                    <button className="btn-xs primary" onClick={() => { setItemToEdit({ item: null, category }); setIsShopItemModalOpen(true); }}>+ 추가</button>
                                </div>
                                <div className="grid-card-body">
                                    {(shopItemsByCategory[category] && shopItemsByCategory[category].length > 0) ? (
                                        <div className="shop-item-mini-grid">
                                            {shopItemsByCategory[category].sort((a,b) => a.price - b.price).map(item => (
                                                <div key={item.id} className="shop-item-mini-card">
                                                    <div className="item-details">
                                                        <p className="name">{item.name}</p>
                                                        <p className="price">{item.price} 스톤</p>
                                                    </div>
                                                    <div className="item-actions">
                                                        <button className="icon-btn" onClick={() => { setItemToEdit({item}); setIsShopItemModalOpen(true); }}>✎</button>
                                                        <button className="icon-btn danger" onClick={() => handleDeleteShopItem(item.id)}>×</button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="empty-state-mini">상품이 없습니다.</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
            
            <StudentFormModal isOpen={isStudentModalOpen} onClose={() => setIsStudentModalOpen(false)} onSave={handleSaveStudent} studentToEdit={studentToEdit} />
            <MissionFormModal isOpen={isMissionModalOpen} onClose={() => setIsMissionModalOpen(false)} onSave={handleSaveMission} missionToEdit={missionToEdit} groupSettings={groupSettings} groupOrder={generalSettings.groupOrder} isChessMission={missionTypeToAdd === 'chess' || (!!missionToEdit && !missionToEdit.group)} />
            <ShopItemFormModal isOpen={isShopItemModalOpen} onClose={() => setIsShopItemModalOpen(false)} onSave={handleSaveShopItem} itemToEdit={itemToEdit} categories={shopCategories} />
            <BulkStoneAwardModal isOpen={isBulkAwardModalOpen} onClose={() => setIsBulkAwardModalOpen(false)} onAward={handleBulkAward} />
            <BulkAllStudentsAwardModal
                isOpen={isBulkAllStudentsAwardModalOpen}
                onClose={() => setIsBulkAllStudentsAwardModalOpen(false)}
                onAward={handleBulkAwardToAll}
            />
            <CouponFormModal isOpen={isCouponModalOpen} onClose={() => setIsCouponModalOpen(false)} onSave={handleSaveCoupon} studentName={studentForCoupon?.name || ''} />
            {isGroupSettingsModalOpen && <GroupSettingsModal isOpen={isGroupSettingsModalOpen} onClose={() => setIsGroupSettingsModalOpen(false)} groupSettings={groupSettings} generalSettings={generalSettings} onUpdateGroupSettings={onUpdateGroupSettings} onUpdateGeneralSettings={onUpdateGeneralSettings} />}
            {isShopSettingsModalOpen && <ShopSettingsModal isOpen={isShopSettingsModalOpen} onClose={() => setIsShopSettingsModalOpen(false)} shopSettings={shopSettings} setShopSettings={setShopSettings} shopCategories={shopCategories} setShopCategories={setShopCategories} shopItems={shopItems} setShopItems={setShopItems} setConfirmation={setConfirmation} />}
            {isSpecialMissionModalOpen && (
                <SpecialMissionManagerModal 
                    isOpen={isSpecialMissionModalOpen} 
                    onClose={() => setIsSpecialMissionModalOpen(false)} 
                    specialMissions={specialMissions} 
                    onUpdateSpecialMissions={setSpecialMissions} 
                    groupSettings={groupSettings} 
                    groupOrder={generalSettings.groupOrder} 
                    // FIX: Passed missing properties generalSettings and onUpdateGeneralSettings.
                    generalSettings={generalSettings}
                    onUpdateGeneralSettings={onUpdateGeneralSettings}
                />
            )}
            {isPersonalMissionTemplateModalOpen && (
                <PersonalMissionTemplateModal
                    isOpen={isPersonalMissionTemplateModalOpen}
                    onClose={() => setIsPersonalMissionTemplateModalOpen(false)}
                    templates={personalMissionTemplates}
                    onUpsert={onUpsertPersonalMissionTemplate}
                    onDelete={onDeletePersonalMissionTemplate}
                    groupSettings={groupSettings}
                    groupOrder={generalSettings.groupOrder}
                />
            )}
            {isAssignPersonalMissionModalOpen && (
                <AssignPersonalMissionModal
                    isOpen={isAssignPersonalMissionModalOpen}
                    onClose={() => setIsAssignPersonalMissionModalOpen(false)}
                    students={students}
                    groupSettings={groupSettings}
                    groupOrder={generalSettings.groupOrder}
                    initialStudentIds={personalMissionInitialStudentIds}
                    onAssign={(studentIds, mission) => {
                        onBulkAddPersonalMission(studentIds, mission);
                        setSelectedStudentIds(new Set());
                    }}
                />
            )}
            {confirmation && <ConfirmationModal {...confirmation} onClose={() => setConfirmation(null)} />}
        </div>
    );
};
