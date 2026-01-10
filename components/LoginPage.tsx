
import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase'; // Firebase 설정 가져오기

interface LoginPageProps {
    onLoginSuccess: (role: 'master' | 'admin') => void;
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

        // 1. Check for master account first (local check)
        if (username === 'bsbaduk' && password === '230123') {
            onLoginSuccess('master');
            setLoading(false);
            return;
        }

        // 2. Try to sign in with Firebase for regular admin accounts
        try {
            if (!auth) {
                throw new Error("Firebase 인증 서비스를 초기화할 수 없습니다.");
            }
            await signInWithEmailAndPassword(auth, username, password);
            // onAuthStateChanged in App.tsx will handle the login success
            // onLoginSuccess('admin') is not needed here as auth state change is the source of truth
        } catch (error: any) {
            console.error("Firebase login error:", error);
            switch (error.code) {
                case 'auth/user-not-found':
                case 'auth/wrong-password':
                case 'auth/invalid-credential':
                    setError('아이디 또는 비밀번호가 올바르지 않습니다.');
                    break;
                case 'auth/invalid-email':
                    setError('유효하지 않은 이메일 형식입니다.');
                    break;
                default:
                    setError(error.message || '로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
                    break;
            }
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
