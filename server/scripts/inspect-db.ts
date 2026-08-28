import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

async function main() {
    const users = await pool.query(`SELECT id, email, role, status FROM users ORDER BY role, email`);
    console.log('users:', users.rows.length);
    for (const u of users.rows) {
        console.log(`  - ${u.role} | ${u.email} | ${u.status}`);
    }

    const data = await pool.query(`
        SELECT u.email, u.role,
               jsonb_array_length(COALESCE(a.data->'students', '[]'::jsonb)) AS students,
               a.data->'generalSettings'->>'academyName' AS academy
        FROM app_data a
        JOIN users u ON u.id = a.user_id
        ORDER BY u.email
    `);
    for (const r of data.rows) {
        console.log(`  - ${r.role} | ${r.email} | students: ${r.students} | ${r.academy || ''}`);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => pool.end());
