import dotenv from 'dotenv';
import admin from 'firebase-admin';
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import fs from 'fs';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
const FIREBASE_SERVICE_ACCOUNT_PATH = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
const FIREBASE_SERVICE_ACCOUNT_JSON = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || 'changeme123';

if (!DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(1);
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('railway') ? { rejectUnauthorized: false } : undefined,
});

function initFirebase() {
    if (admin.apps.length > 0) return;
    if (FIREBASE_SERVICE_ACCOUNT_JSON) {
        admin.initializeApp({
            credential: admin.credential.cert(JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON)),
        });
        return;
    }
    if (FIREBASE_SERVICE_ACCOUNT_PATH && fs.existsSync(FIREBASE_SERVICE_ACCOUNT_PATH)) {
        const serviceAccount = JSON.parse(fs.readFileSync(FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8'));
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        return;
    }
    throw new Error('Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH');
}

async function migrateFirestore() {
    initFirebase();
    const db = admin.firestore();

    const usersSnap = await db.collection('users').get();
    console.log(`Found ${usersSnap.size} user documents in Firestore`);

    for (const doc of usersSnap.docs) {
        const uid = doc.id;
        const data = doc.data();
        const { _lastUpdatedAt, ...appData } = data;
        const lastUpdatedAt = typeof _lastUpdatedAt === 'number' ? _lastUpdatedAt : Date.now();

        const email = `migrated_${uid}@badukstone.local`;
        const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);

        const existing = await pool.query('SELECT id FROM users WHERE id = $1', [uid]);
        if (existing.rows.length > 0) {
            await pool.query(
                `UPDATE app_data SET data = $1::jsonb, last_updated_at = $2, updated_at = NOW()
                 WHERE user_id = $3`,
                [JSON.stringify(appData), lastUpdatedAt, uid]
            );
            console.log(`Updated app_data for ${uid}`);
            continue;
        }

        await pool.query(
            `INSERT INTO users (id, email, password_hash, role, status)
             VALUES ($1, $2, $3, 'admin', 'active')
             ON CONFLICT (email) DO NOTHING`,
            [uid, email, passwordHash]
        );

        await pool.query(
            `INSERT INTO app_data (user_id, data, last_updated_at)
             VALUES ($1, $2::jsonb, $3)
             ON CONFLICT (user_id) DO UPDATE SET
               data = EXCLUDED.data,
               last_updated_at = EXCLUDED.last_updated_at`,
            [uid, JSON.stringify(appData), lastUpdatedAt]
        );
        console.log(`Migrated user ${uid} (temp email: ${email})`);
    }

    const masterSnap = await db.doc('master/app_data').get();
    if (masterSnap.exists) {
        const masterData = masterSnap.data() as { managedUsers?: Array<{ uid: string; email: string; status: string }> };
        for (const managed of masterData.managedUsers || []) {
            const existing = await pool.query('SELECT id FROM users WHERE id = $1', [managed.uid]);
            if (existing.rows.length > 0) {
                await pool.query(
                    'UPDATE users SET email = $1, status = $2, updated_at = NOW() WHERE id = $3',
                    [managed.email, managed.status, managed.uid]
                );
            } else {
                const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
                await pool.query(
                    `INSERT INTO users (id, email, password_hash, role, status)
                     VALUES ($1, $2, $3, 'admin', $4)`,
                    [managed.uid, managed.email, passwordHash, managed.status]
                );
            }
            console.log(`Synced managed user: ${managed.email}`);
        }
    }

    console.log(`\nMigration complete. Default password for migrated accounts: ${DEFAULT_ADMIN_PASSWORD}`);
    console.log('Users should change their password after first login.');
}

migrateFirestore()
    .catch((err) => {
        console.error(err);
        process.exit(1);
    })
    .finally(() => pool.end());
