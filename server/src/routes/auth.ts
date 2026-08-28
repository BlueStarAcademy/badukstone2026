import { Router } from 'express';
import { query } from '../db';
import type { DbUser } from '../db';
import {
    authMiddleware,
    clearAuthCookie,
    hashPassword,
    setAuthCookie,
    signToken,
    toAuthPayload,
    verifyPassword,
} from '../middleware/auth';

const router = Router();

router.post('/login', async (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
        res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.' });
        return;
    }

    const result = await query<DbUser>(
        'SELECT * FROM users WHERE email = $1',
        [email.trim()]
    );
    const user = result.rows[0];
    if (!user) {
        res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
        return;
    }
    if (user.status === 'disabled') {
        res.status(403).json({ error: '비활성화된 계정입니다. 관리자에게 문의하세요.' });
        return;
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
        res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
        return;
    }

    const payload = toAuthPayload(user);
    const token = signToken(payload);
    setAuthCookie(res, token);
    res.json({ user: { uid: user.id, email: user.email, role: user.role } });
});

router.post('/logout', (_req, res) => {
    clearAuthCookie(res);
    res.json({ ok: true });
});

router.get('/me', authMiddleware, async (req, res) => {
    const result = await query<DbUser>('SELECT * FROM users WHERE id = $1', [req.user!.userId]);
    const user = result.rows[0];
    if (!user || user.status === 'disabled') {
        clearAuthCookie(res);
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    res.json({ user: { uid: user.id, email: user.email, role: user.role } });
});

router.patch('/password', authMiddleware, async (req, res) => {
    const { currentPassword, newPassword } = req.body as {
        currentPassword?: string;
        newPassword?: string;
    };
    if (!currentPassword || !newPassword) {
        res.status(400).json({ error: '현재 비밀번호와 새 비밀번호를 입력해주세요.' });
        return;
    }
    if (newPassword.length < 6) {
        res.status(400).json({ error: '새 비밀번호는 6자 이상이어야 합니다.' });
        return;
    }
    if (req.user!.role === 'master') {
        res.status(400).json({ error: '마스터 계정의 비밀번호는 이 화면에서 변경할 수 없습니다.' });
        return;
    }

    const result = await query<DbUser>('SELECT * FROM users WHERE id = $1', [req.user!.userId]);
    const user = result.rows[0];
    if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const valid = await verifyPassword(currentPassword, user.password_hash);
    if (!valid) {
        res.status(400).json({ error: '현재 비밀번호가 올바르지 않습니다.' });
        return;
    }

    const passwordHash = await hashPassword(newPassword);
    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
        passwordHash,
        user.id,
    ]);
    res.json({ ok: true });
});

export default router;
