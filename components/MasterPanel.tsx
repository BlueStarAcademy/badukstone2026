
import React, { useState, useEffect } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase'; // Firebase 인스턴스 가져오기
// FIX: Added INITIAL_SPECIAL_MISSIONS to resolve property missing error in AppData.
import { INITIAL_MISSIONS, INITIAL_SHOP_ITEMS, INITIAL_GROUP_SETTINGS, INITIAL_GENERAL_SETTINGS, INITIAL_EVENT_SETTINGS, INITIAL_TOURNAMENT_DATA, INITIAL_TOURNAMENT_SETTINGS, INITIAL_SHOP_CATEGORIES, INITIAL_GACHA_STATES, INITIAL_CHESS_MISSIONS, INITIAL_SPECIAL_MISSIONS } from '../data/initialData';
import type { AppData, User, MasterData, ManagedUser } from '../types';
import { ConfirmationModal } from './modals/ConfirmationModal';

// 새 사용자를 위한 초기 데이터 생성 함수
const getInitialDataForNewUser = (): AppData => ({
    groupSettings: INITIAL_GROUP_SETTINGS,
    generalSettings: INITIAL_GENERAL_SETTINGS,
    eventSettings: INITIAL_EVENT_SETTINGS,
    tournamentSettings: INITIAL_TOURNAMENT_SETTINGS,
    shopSettings: { bulkPurchaseDiscountRate: 0 },
    students: [],
    missions: INITIAL_MISSIONS,
    // FIX: Added the 'chessMissions' property to match the 'AppData' type definition.
    chessMissions: INITIAL_CHESS_MISSIONS,
    /**
     * FIX: Added missing specialMissions property to match AppData requirements.
     */
    specialMissions: INITIAL_SPECIAL_MISSIONS,
    shopItems: INITIAL_SHOP_ITEMS,
    transactions: [],
    coupons: [],
    shopCategories: INITIAL_SHOP_CATEGORIES,
    chessMatches: [],
    gachaState: INITIAL_GACHA_STATES,
    tournamentData: { ...INITIAL_TOURNAMENT_DATA, participantIds: [], teams: [{ name: 'A', players: [] }, { name: 'B', players: [] }] },
    lastBirthdayCouponMonth: null,
    individualMissionSeries: [],
    studentMissionProgress: {},
});

const MASTER_DATA_PATH = 'master/app_data';

export const MasterPanel: React.FC<{ user: User }> = ({ user }) => {
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [masterData, setMasterData] = useState<MasterData>({ managedUsers: [] });
    const [confirmation, setConfirmation] = useState<any>(null);

     useEffect(() => {
        if (!db) return;
        const docRef = doc(db, MASTER_DATA_PATH);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                setMasterData(docSnap.data() as MasterData);
            } else {
                // If it doesn't exist, create it
                const initialData: MasterData = { managedUsers: [] };
                setDoc(docRef, initialData).catch(e => console.error("Could not create master data doc", e));
                setMasterData(initialData);
            }
        }, (err) => {
            console.error("Error fetching master data:", err);
            setError("마스터 데이터를 불러오는 데 실패했습니다.");
        });

        return () => unsubscribe();
    }, []);

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!newUsername.trim() || !newPassword.trim()) {
            setError('아이디와 비밀번호를 모두 입력해주세요.');
            return;
        }
        if (newPassword.trim().length < 6) {
            setError('비밀번호는 6자리 이상이어야 합니다.');
            return;
        }

        setLoading(true);
        try {
             if (!auth || !db) {
                throw new Error("Firebase 서비스를 초기화할 수 없습니다.");
            }
            // 1. Firebase Authentication에 사용자 생성
            const userCredential = await createUserWithEmailAndPassword(auth, newUsername, newPassword);
            const newUser = userCredential.user;

            // 2. Firestore에 해당 사용자를 위한 데이터 문서 생성
            const initialData = getInitialDataForNewUser();
            await setDoc(doc(db, "users", newUser.uid), initialData);
            
            // 3. 마스터 데이터 문서에 새 사용자 정보 추가
            const newUserInfo: ManagedUser = { uid: newUser.uid, email: newUsername, status: 'active' };
            const updatedUsers = [...(masterData?.managedUsers || []), newUserInfo];
            await setDoc(doc(db, MASTER_DATA_PATH), { managedUsers: updatedUsers });

            setSuccess(`'${newUsername}' 계정이 성공적으로 생성되었습니다.`);
            setNewUsername('');
            setNewPassword('');

        } catch (error: any) {
            console.error("Error creating user:", error);
            if (error.code === 'auth/email-already-in-use') {
                setError('이미 사용 중인 이메일 주소입니다.');
            } else if (error.code === 'auth/invalid-email') {
                setError('유효하지 않은 이메일 형식입니다.');
            } else if (error.code === 'auth/configuration-not-found') {
                setError('계정 생성 실패: Firebase 프로젝트에서 "이메일/비밀번호" 로그인 방식이 활성화되지 않았습니다. Firebase 콘솔의 [Authentication -> Sign-in method] 탭에서 활성화해주세요.');
            } else {
                setError(`계정 생성에 실패했습니다: ${error.message}`);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleToggleStatus = async (userToUpdate: ManagedUser) => {
        if (!db) return;
        const newStatus = userToUpdate.status === 'active' ? 'disabled' : 'active';
        const updatedUsers = masterData.managedUsers.map(u => 
            u.uid === userToUpdate.uid ? { ...u, status: newStatus } : u
        );
        try {
            await setDoc(doc(db, MASTER_DATA_PATH), { managedUsers: updatedUsers });
            setSuccess(`'${userToUpdate.email}' 계정 상태가 '${newStatus}'(으)로 변경되었습니다.`);
        } catch (e) {
            setError("계정 상태 변경에 실패했습니다.");
        }
    };

    const handleDeleteUser = (userToDelete: ManagedUser) => {
        setConfirmation({
            message: `'${userToDelete.email}' 계정을 목록에서 삭제하시겠습니까?\n\n(주의: 이 작업은 마스터 목록에서만 제거하며, 실제 계정이나 데이터는 삭제되지 않습니다. 완전 삭제는 Firebase 콘솔에서 직접 해야 합니다.)`,
            actions: [
                { text: '취소', onClick: () => setConfirmation(null) },
                { text: '삭제', className: 'danger', onClick: async () => {
                    if (!db) return;
                    const updatedUsers = masterData.managedUsers.filter(u => u.uid !== userToDelete.uid);
                    try {
                        await setDoc(doc(db, MASTER_DATA_PATH), { managedUsers: updatedUsers });
                        setSuccess(`'${userToDelete.email}' 계정이 목록에서 삭제되었습니다.`);
                    } catch (e) {
                        setError("계정 삭제에 실패했습니다.");
                    }
                    setConfirmation(null);
                }}
            ]
        });
    };

    return (
        <div className="master-panel">
            <h2>마스터 계정 관리</h2>
            <div className="master-panel-content">
                <div className="create-user-form">
                    <h3>신규 학원 계정 발급</h3>
                    <p style={{ color: 'var(--text-color-secondary)', marginBottom: '1rem' }}>
                        새로운 학원(사용자)을 위한 로그인 계정을 생성합니다. 생성된 계정은 독립된 데이터 공간을 가집니다.
                    </p>
                    <form onSubmit={handleCreateUser}>
                        {error && <p className="login-error">{error}</p>}
                        {success && <p className="success-message">{success}</p>}
                        <div className="form-group">
                            <label htmlFor="new-username">아이디 (이메일 형식)</label>
                            <input
                                id="new-username"
                                type="email"
                                value={newUsername}
                                onChange={e => setNewUsername(e.target.value)}
                                placeholder="example@school.com"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="new-password">초기 비밀번호</label>
                            <input
                                id="new-password"
                                type="text"
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                placeholder="6자리 이상"
                                required
                            />
                        </div>
                        <button type="submit" className="btn primary" disabled={loading}>
                            {loading ? '생성 중...' : '계정 생성'}
                        </button>
                    </form>
                </div>
                <div className="user-list-section">
                     <h3>생성된 계정 목록</h3>
                     <div className="student-table" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                         <table>
                             <thead>
                                 <tr>
                                     <th>아이디 (이메일)</th>
                                     <th>상태</th>
                                     <th>작업</th>
                                 </tr>
                             </thead>
                             <tbody>
                                 {masterData.managedUsers.map(u => (
                                     <tr key={u.uid}>
                                         <td>{u.email}</td>
                                         <td>
                                             <span style={{ color: u.status === 'active' ? 'var(--success-color)' : 'var(--danger-color)'}}>
                                                 {u.status === 'active' ? '사용 중' : '정지됨'}
                                             </span>
                                         </td>
                                         <td className="actions">
                                             <button className="btn-sm" onClick={() => handleToggleStatus(u)}>
                                                 {u.status === 'active' ? '정지' : '활성화'}
                                             </button>
                                             <button className="btn-sm danger" onClick={() => handleDeleteUser(u)}>삭제</button>
                                         </td>
                                     </tr>
                                 ))}
                                 {masterData.managedUsers.length === 0 && (
                                    <tr><td colSpan={3} style={{textAlign: 'center'}}>생성된 계정이 없습니다.</td></tr>
                                 )}
                             </tbody>
                         </table>
                     </div>
                </div>
            </div>
            {confirmation && <ConfirmationModal {...confirmation} onClose={() => setConfirmation(null)} />}
        </div>
    );
};
