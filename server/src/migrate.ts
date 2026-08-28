import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { pool } from './db';
import { config } from './config';

export async function runMigrations() {
    const sqlPath = path.join(__dirname, '../migrations/001_init.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await pool.query(sql);

    const masterCheck = await pool.query('SELECT id FROM users WHERE role = $1', ['master']);
    if (masterCheck.rows.length === 0) {
        const passwordHash = await bcrypt.hash(config.masterPassword, 10);
        await pool.query(
            `INSERT INTO users (email, password_hash, role, status)
             VALUES ($1, $2, 'master', 'active')`,
            [config.masterEmail, passwordHash]
        );
        console.log(`Master user seeded: ${config.masterEmail}`);
    }
}
