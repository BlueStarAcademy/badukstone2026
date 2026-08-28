import { Router } from 'express';
import { query } from '../db';
import { adminOnly, authMiddleware } from '../middleware/auth';
import { compactData } from '../utils/compactData';
import { addSseClient, broadcastAppDataUpdate } from '../utils/sse';

const router = Router();

router.get('/', authMiddleware, adminOnly, async (req, res) => {
    const result = await query<{ data: Record<string, unknown>; last_updated_at: string }>(
        'SELECT data, last_updated_at FROM app_data WHERE user_id = $1',
        [req.user!.userId]
    );
    const row = result.rows[0];
    if (!row) {
        res.json({ data: null, lastUpdatedAt: 0 });
        return;
    }
    res.json({
        data: row.data,
        lastUpdatedAt: Number(row.last_updated_at),
    });
});

router.put('/', authMiddleware, adminOnly, async (req, res) => {
    const body = req.body as { data?: Record<string, unknown> };
    if (!body.data || typeof body.data !== 'object') {
        res.status(400).json({ error: 'Invalid data' });
        return;
    }

    const compacted = compactData(body.data);
    const lastUpdatedAt = Date.now();

    await query(
        `INSERT INTO app_data (user_id, data, last_updated_at, updated_at)
         VALUES ($1, $2::jsonb, $3, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           data = EXCLUDED.data,
           last_updated_at = EXCLUDED.last_updated_at,
           updated_at = NOW()`,
        [req.user!.userId, JSON.stringify(compacted), lastUpdatedAt]
    );

    broadcastAppDataUpdate(req.user!.userId, lastUpdatedAt);
    res.json({ ok: true, lastUpdatedAt });
});

router.get('/stream', authMiddleware, adminOnly, async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    res.write(': connected\n\n');
    addSseClient(req.user!.userId, res);

    const heartbeat = setInterval(() => {
        res.write(': heartbeat\n\n');
    }, 25000);

    req.on('close', () => clearInterval(heartbeat));
});

export default router;
