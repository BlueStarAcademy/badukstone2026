import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import admin from 'firebase-admin';

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../.env.local'), override: true });

const keyPaths = [
    path.join(__dirname, '../firebase-service-account.json'),
    path.join(__dirname, '../../firebase-service-account.json'),
];
const keyPath = keyPaths.find((p) => fs.existsSync(p));
if (!keyPath) throw new Error('Firebase key not found');

admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(fs.readFileSync(keyPath, 'utf8'))),
});

const db = admin.firestore();

async function main() {
    const master = await db.doc('master/app_data').get();
    console.log('master/app_data exists:', master.exists);
    if (master.exists) {
        const d = master.data() || {};
        console.log('master keys:', Object.keys(d));
        const managed = Array.isArray(d.managedUsers) ? d.managedUsers : [];
        console.log('managedUsers:', managed.length);
        for (const u of managed) {
            console.log(`  - ${u.email} | ${u.uid} | ${u.status}`);
        }
    }

    const users = await db.collection('users').get();
    console.log('users collection:', users.size);
    for (const doc of users.docs) {
        const students = Array.isArray(doc.data().students) ? doc.data().students.length : 0;
        const academy = doc.data().generalSettings?.academyName || '(no name)';
        console.log(`  - ${doc.id} | students: ${students} | academy: ${academy}`);
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
