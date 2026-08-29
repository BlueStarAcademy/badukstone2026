
import React, { useState } from 'react';
import { api } from '../api/client';
import type { User } from '../types';

interface LoginPageProps {
    onLoginSuccess: (user: User) => void;
    isDemoMode?: boolean;
    onDemoClick?: () => void;
}

export const LoginPage = ({ onLoginSuccess, isDemoMode, onDemoClick }: LoginPageProps) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const result = await api.login(username, password);
            onLoginSuccess({
                uid: result.user.uid,
                email: result.user.email,
                role: result.user.role,
            });
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : '로그인 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <h1 className="login-title">바둑학원 포인트 관리</h1>
            <div className="login-form">
                <form onSubmit={handleSubmit} style={{display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
                    <p>관리자 로그인이 필요합니다.</p>
                    <div className="form-group">
                        <label htmlFor="username">이메일 또는 아이디</label>
                        <input
                            type="text"
                            id="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            autoFocus
                            autoComplete="username"
                            placeholder="이메일 주소 또는 아이디"
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="password">비밀번호</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            autoComplete="current-password"
                            placeholder="비밀번호 입력"
                        />
                    </div>
                    {error && <p className="login-error">{error}</p>}
                    <button type="submit" className="btn primary login-btn" disabled={loading}>
                        {loading ? '로그인 중...' : '로그인'}
                    </button>
                    {isDemoMode && onDemoClick && (
                        <button 
                            type="button" 
                            className="btn login-btn" 
                            onClick={onDemoClick}
                            style={{marginTop: '0.5rem', backgroundColor: '#6c757d', color: 'white'}}
                        >
                            체험 모드(Demo)로 시작
                        </button>
                    )}
                </form>
            </div>
        </div>
    );
};
