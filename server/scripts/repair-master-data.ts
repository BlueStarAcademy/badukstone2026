import dotenv from 'dotenv';
import path from 'path';
import { Pool } from 'pg';
import { createHash } from 'crypto';

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../.env.local'), override: true });

function firebaseUidToUuid(firebaseUid: string): string {
    const hash = createHash('sha256').update(`badukstone:${firebaseUid}`).digest('hex');
    return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('railway') ? { rejectUnauthorized: false } : undefined,
});

async function repairMasterData() {
    const masterResult = await pool.query<{ id: string; email: string }>(
        "SELECT id, email FROM users WHERE role = 'master' LIMIT 1"
    );
    const master = masterResult.rows[0];
    if (!master) throw new Error('Master user not found');

    const legacyMasterUserId = firebaseUidToUuid('master');
    const legacyResult = await pool.query<{ data: Record<string, unknown>; last_updated_at: string }>(
        'SELECT data, last_updated_at FROM app_data WHERE user_id = $1',
        [legacyMasterUserId]
    );
    const legacy = legacyResult.rows[0];
    if (!legacy) throw new Error('Legacy master app_data not found');

    const students = Array.isArray(legacy.data.students) ? legacy.data.students.length : 0;
    console.log(`Moving ${students} students from legacy master account to ${master.email}`);

    await pool.query(
        `INSERT INTO app_data (user_id, data, last_updated_at, updated_at)
         VALUES ($1, $2::jsonb, $3, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           data = EXCLUDED.data,
           last_updated_at = EXCLUDED.last_updated_at,
           updated_at = NOW()`,
        [master.id, JSON.stringify(legacy.data), legacy.last_updated_at]
    );

    await pool.query('DELETE FROM app_data WHERE user_id = $1', [legacyMasterUserId]);
    await pool.query("DELETE FROM users WHERE id = $1 AND role = 'admin'", [legacyMasterUserId]);

    console.log('Master data repair complete.');
}

repairMasterData()
    .catch((err) => {
        console.error(err);
        process.exit(1);
    })
    .finally(() => pool.end());
