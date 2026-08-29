
import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { User, MasterData, ManagedUser } from '../types';
import { ConfirmationModal } from './modals/ConfirmationModal';

export const MasterPanel: React.FC<{ user: User }> = ({ user }) => {
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [masterData, setMasterData] = useState<MasterData>({ managedUsers: [] });
    const [confirmation, setConfirmation] = useState<any>(null);

    const loadMasterData = async () => {
        try {
            const result = await api.getMasterUsers();
            setMasterData({ managedUsers: result.managedUsers });
        } catch (err) {
            console.error('Error fetching master data:', err);
            setError('마스터 데이터를 불러오는 데 실패했습니다.');
        }
    };

    useEffect(() => {
        loadMasterData();
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
            await api.createMasterUser(newUsername, newPassword);
            setSuccess(`'${newUsername}' 계정이 성공적으로 생성되었습니다.`);
            setNewUsername('');
            setNewPassword('');
            await loadMasterData();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : '계정 생성에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleStatus = async (userToUpdate: ManagedUser) => {
        const newStatus = userToUpdate.status === 'active' ? 'disabled' : 'active';
        try {
            await api.updateMasterUserStatus(userToUpdate.uid, newStatus);
            setSuccess(`'${userToUpdate.email}' 계정 상태가 '${newStatus}'(으)로 변경되었습니다.`);
            await loadMasterData();
        } catch {
            setError('계정 상태 변경에 실패했습니다.');
        }
    };

    const handleDeleteUser = (userToDelete: ManagedUser) => {
        setConfirmation({
            message: `'${userToDelete.email}' 계정을 목록에서 삭제하시겠습니까?`,
            actions: [
                { text: '취소', onClick: () => setConfirmation(null) },
                { text: '삭제', className: 'danger', onClick: async () => {
                    try {
                        await api.deleteMasterUser(userToDelete.uid);
                        setSuccess(`'${userToDelete.email}' 계정이 목록에서 삭제되었습니다.`);
                        await loadMasterData();
                    } catch {
                        setError('계정 삭제에 실패했습니다.');
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
                    <p className="master-panel-desc">
                        새로운 학원(사용자)을 위한 로그인 계정을 생성합니다. 생성된 계정은 독립된 데이터 공간을 가집니다.
                    </p>
                    <form onSubmit={handleCreateUser}>
                        <div className="form-group">
                            <label htmlFor="new-username">이메일 (로그인 ID)</label>
                            <input
                                type="email"
                                id="new-username"
                                value={newUsername}
                                onChange={(e) => setNewUsername(e.target.value)}
                                placeholder="example@baduk.com"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="new-password">초기 비밀번호</label>
                            <input
                                type="password"
                                id="new-password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="6자 이상"
                                required
                            />
                        </div>
                        {error && <p className="login-error">{error}</p>}
                        {success && <p className="success-message">{success}</p>}
                        <button type="submit" className="btn primary" disabled={loading}>
                            {loading ? '생성 중...' : '계정 생성'}
                        </button>
                    </form>
                </div>

                <div className="managed-users-list">
                    <h3>등록된 학원 계정 ({masterData.managedUsers.length})</h3>
                    {masterData.managedUsers.length === 0 ? (
                        <p>등록된 계정이 없습니다.</p>
                    ) : (
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>이메일</th>
                                    <th>상태</th>
                                    <th>작업</th>
                                </tr>
                            </thead>
                            <tbody>
                                {masterData.managedUsers.map((u) => (
                                    <tr key={u.uid}>
                                        <td>{u.email}</td>
                                        <td>
                                            <span className={`status-badge ${u.status}`}>
                                                {u.status === 'active' ? '활성' : '비활성'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="master-actions">
                                                <button
                                                    className="btn-sm"
                                                    onClick={() => handleToggleStatus(u)}
                                                >
                                                    {u.status === 'active' ? '비활성화' : '활성화'}
                                                </button>
                                                <button
                                                    className="btn-sm danger"
                                                    onClick={() => handleDeleteUser(u)}
                                                >
                                                    삭제
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
            {confirmation && <ConfirmationModal {...confirmation} onClose={() => setConfirmation(null)} />}
        </div>
    );
};
