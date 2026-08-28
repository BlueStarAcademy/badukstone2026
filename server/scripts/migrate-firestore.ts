import dotenv from 'dotenv';
import path from 'path';
import { createHash } from 'crypto';
import admin from 'firebase-admin';
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import fs from 'fs';

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../.env.local'), override: true });

const DEFAULT_FIREBASE_KEY_PATHS = [
    path.join(__dirname, '../firebase-service-account.json'),
    path.join(__dirname, '../../firebase-service-account.json'),
];
const DATABASE_URL = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
const FIREBASE_SERVICE_ACCOUNT_PATH =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    DEFAULT_FIREBASE_KEY_PATHS.find((candidate) => fs.existsSync(candidate));
const FIREBASE_SERVICE_ACCOUNT_JSON = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || 'changeme123';

if (!DATABASE_URL) {
    console.error('DATABASE_URL is required.\n');
    console.error('Option A: set Railway Postgres public URL in server/.env.local:');
    console.error('  DATABASE_URL=postgresql://...  (Railway → Postgres → Connect → Public Network)\n');
    console.error('Option B: create a TCP proxy and use DATABASE_PUBLIC_URL in server/.env.local\n');
    console.error('Also required:');
    console.error('  FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json');
    process.exit(1);
}

if (DATABASE_URL.includes('railway.internal')) {
    console.error(
        'DATABASE_URL points to postgres.railway.internal, which is not reachable from your PC.\n' +
        'Use the Railway Postgres public/proxy URL in server/.env.local instead.'
    );
    process.exit(1);
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('railway') ? { rejectUnauthorized: false } : undefined,
});

function firebaseUidToUuid(firebaseUid: string): string {
    const hash = createHash('sha256').update(`badukstone:${firebaseUid}`).digest('hex');
    return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

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
    throw new Error(
        'Firebase service account is required.\n' +
        'Download from Firebase Console → Project Settings → Service Accounts → Generate new private key.\n' +
        'Then set in server/.env:\n' +
        '  FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json'
    );
}

async function migrateFirestore() {
    initFirebase();
    const db = admin.firestore();

    await pool.query('SELECT 1');
    console.log('Connected to PostgreSQL.');

    const usersSnap = await db.collection('users').get();
    console.log(`Found ${usersSnap.size} user documents in Firestore`);

    let totalStudents = 0;

    for (const doc of usersSnap.docs) {
        const firebaseUid = doc.id;
        const userId = firebaseUidToUuid(firebaseUid);
        const data = doc.data();
        const { _lastUpdatedAt, ...appData } = data;
        const lastUpdatedAt = typeof _lastUpdatedAt === 'number' ? _lastUpdatedAt : Date.now();
        const students = Array.isArray((appData as { students?: unknown }).students)
            ? (appData as { students: unknown[] }).students
            : [];
        totalStudents += students.length;

        const email = `migrated_${firebaseUid}@badukstone.local`;
        const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);

        const existing = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
        if (existing.rows.length > 0) {
            await pool.query(
                `UPDATE app_data SET data = $1::jsonb, last_updated_at = $2, updated_at = NOW()
                 WHERE user_id = $3`,
                [JSON.stringify(appData), lastUpdatedAt, userId]
            );
            console.log(`Updated app_data for ${firebaseUid}`);
            continue;
        }

        await pool.query(
            `INSERT INTO users (id, email, password_hash, role, status)
             VALUES ($1, $2, $3, 'admin', 'active')
             ON CONFLICT (email) DO NOTHING`,
            [userId, email, passwordHash]
        );

        await pool.query(
            `INSERT INTO app_data (user_id, data, last_updated_at)
             VALUES ($1, $2::jsonb, $3)
             ON CONFLICT (user_id) DO UPDATE SET
               data = EXCLUDED.data,
               last_updated_at = EXCLUDED.last_updated_at`,
            [userId, JSON.stringify(appData), lastUpdatedAt]
        );
        console.log(`Migrated user ${firebaseUid} (temp email: ${email})`);
    }

    const masterSnap = await db.doc('master/app_data').get();
    if (masterSnap.exists) {
        const masterData = masterSnap.data() as { managedUsers?: Array<{ uid: string; email: string; status: string }> };
        for (const managed of masterData.managedUsers || []) {
            const userId = firebaseUidToUuid(managed.uid);
            const existing = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
            if (existing.rows.length > 0) {
                await pool.query(
                    'UPDATE users SET email = $1, status = $2, updated_at = NOW() WHERE id = $3',
                    [managed.email, managed.status, userId]
                );
            } else {
                const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
                await pool.query(
                    `INSERT INTO users (id, email, password_hash, role, status)
                     VALUES ($1, $2, $3, 'admin', $4)`,
                    [userId, managed.email, passwordHash, managed.status]
                );
            }
            console.log(`Synced managed user: ${managed.email}`);
        }
    }

    console.log(`\nMigration complete.`);
    console.log(`- Firestore users migrated: ${usersSnap.size}`);
    console.log(`- Students imported: ${totalStudents}`);
    console.log(`- Default password for migrated accounts: ${DEFAULT_ADMIN_PASSWORD}`);
    console.log('Users should change their password after first login.');
}

migrateFirestore()
    .catch((err) => {
        console.error(err);
        process.exit(1);
    })
    .finally(() => pool.end());
