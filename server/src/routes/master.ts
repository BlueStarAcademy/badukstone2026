import { Router } from 'express';
import { query } from '../db';
import type { DbUser } from '../db';
import { authMiddleware, hashPassword, masterOnly } from '../middleware/auth';

const router = Router();

const EMPTY_APP_DATA = {
    groupSettings: {},
    generalSettings: {},
    eventSettings: {},
    tournamentSettings: {},
    shopSettings: { bulkPurchaseDiscountRate: 0 },
    students: [],
    missions: [],
    chessMissions: [],
    specialMissions: [],
    shopItems: [],
    transactions: [],
    coupons: [],
    shopCategories: [],
    chessMatches: [],
    gachaState: {},
    tournamentData: {},
    lastBirthdayCouponMonth: null,
    individualMissionSeries: [],
    studentMissionProgress: {},
    personalMissions: {},
    personalMissionTemplates: [],
};

router.get('/users', authMiddleware, masterOnly, async (_req, res) => {
    const result = await query<DbUser>(
        "SELECT id, email, status FROM users WHERE role = 'admin' ORDER BY created_at ASC"
    );
    res.json({
        managedUsers: result.rows.map((u) => ({
            uid: u.id,
            email: u.email,
            status: u.status,
        })),
    });
});

router.post('/users', authMiddleware, masterOnly, async (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email?.trim() || !password?.trim()) {
        res.status(400).json({ error: '아이디와 비밀번호를 모두 입력해주세요.' });
        return;
    }
    if (password.trim().length < 6) {
        res.status(400).json({ error: '비밀번호는 6자리 이상이어야 합니다.' });
        return;
    }

    const existing = await query('SELECT id FROM users WHERE email = $1', [email.trim()]);
    if (existing.rows.length > 0) {
        res.status(409).json({ error: '이미 사용 중인 이메일 주소입니다.' });
        return;
    }

    const passwordHash = await hashPassword(password);
    const userResult = await query<DbUser>(
        `INSERT INTO users (email, password_hash, role, status)
         VALUES ($1, $2, 'admin', 'active')
         RETURNING *`,
        [email.trim(), passwordHash]
    );
    const newUser = userResult.rows[0];

    await query(
        `INSERT INTO app_data (user_id, data, last_updated_at)
         VALUES ($1, $2::jsonb, $3)`,
        [newUser.id, JSON.stringify(EMPTY_APP_DATA), Date.now()]
    );

    res.status(201).json({
        managedUser: { uid: newUser.id, email: newUser.email, status: newUser.status },
    });
});

router.patch('/users/:id/status', authMiddleware, masterOnly, async (req, res) => {
    const { status } = req.body as { status?: 'active' | 'disabled' };
    if (status !== 'active' && status !== 'disabled') {
        res.status(400).json({ error: 'Invalid status' });
        return;
    }
    const result = await query<DbUser>(
        "UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2 AND role = 'admin' RETURNING *",
        [status, req.params.id]
    );
    if (!result.rows[0]) {
        res.status(404).json({ error: 'User not found' });
        return;
    }
    const u = result.rows[0];
    res.json({ managedUser: { uid: u.id, email: u.email, status: u.status } });
});

router.delete('/users/:id', authMiddleware, masterOnly, async (req, res) => {
    const result = await query(
        "DELETE FROM users WHERE id = $1 AND role = 'admin' RETURNING id",
        [req.params.id]
    );
    if (!result.rows[0]) {
        res.status(404).json({ error: 'User not found' });
        return;
    }
    res.json({ ok: true });
});

export default router;
