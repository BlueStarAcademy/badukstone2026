import React, { useState } from 'react';
import { api } from '../../api/client';
import type { User } from '../../types';
import { ModalShell } from '../ui/ModalShell';

interface AccountSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLogout: () => void;
    user: User;
}

export const AccountSettingsModal = ({ isOpen, onClose, onLogout, user }: AccountSettingsModalProps) => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const isMasterUser = user.role === 'master';

    const handleFormClose = () => {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setError('');
        setSuccess('');
        setLoading(false);
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (newPassword !== confirmPassword) {
            setError('새 비밀번호가 일치하지 않습니다.');
            return;
        }
        if (newPassword.length < 6) {
            setError('새 비밀번호는 6자 이상이어야 합니다.');
            return;
        }

        setLoading(true);

        try {
            await api.changePassword(currentPassword, newPassword);
            setSuccess('비밀번호가 성공적으로 변경되었습니다.');
            setTimeout(() => {
                handleFormClose();
            }, 2000);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : '오류가 발생했습니다. 다시 시도해주세요.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ModalShell
            title="계정 설정"
            size="sm"
            onClose={handleFormClose}
            footer={
                <>
                    <button type="button" className="btn danger" style={{ marginRight: 'auto' }} onClick={() => { onLogout(); handleFormClose(); }}>로그아웃</button>
                    <button type="button" className="btn" onClick={handleFormClose}>취소</button>
                    <button type="submit" form="account-settings-form" className="btn primary" disabled={loading || isMasterUser}>
                        {loading ? '변경 중...' : '비밀번호 변경'}
                    </button>
                </>
            }
        >
            <form id="account-settings-form" onSubmit={handleSubmit}>
                        <div className="settings-form-section">
                            <h3>비밀번호 변경</h3>
                            {isMasterUser ? (
                                <p>마스터 계정 비밀번호는 Railway API 서비스의 MASTER_PASSWORD 환경 변수로 관리됩니다.</p>
                            ) : (
                                <>
                                    <div className="form-group">
                                        <label htmlFor="current-password">현재 비밀번호</label>
                                        <input
                                            type="password"
                                            id="current-password"
                                            value={currentPassword}
                                            onChange={(e) => setCurrentPassword(e.target.value)}
                                            required
                                            autoFocus
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="new-password">새 비밀번호</label>
                                        <input
                                            type="password"
                                            id="new-password"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            required
                                        />
                                        <small>6자 이상이어야 합니다.</small>
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="confirm-password">새 비밀번호 확인</label>
                                        <input
                                            type="password"
                                            id="confirm-password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            required
                                        />
                                    </div>
                                </>
                            )}
                            {error && <p className="login-error">{error}</p>}
                            {success && <p className="success-message">{success}</p>}
                        </div>
            </form>
        </ModalShell>
    );
};
