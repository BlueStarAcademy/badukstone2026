
import { initializeApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore, enableIndexedDbPersistence, terminate } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";

// Safely access environment variables.
const env = (import.meta.env || {}) as any;

const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
let firebaseError: string | null = null;
let isDemoMode = false;

// Check if critical config is missing
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.warn("Firebase config missing. Falling back to Demo Mode.");
    isDemoMode = true;
    firebaseError = "환경 변수가 설정되지 않았습니다. 데모 모드로 실행됩니다.";
} else {
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);

        // Enable Offline Persistence
        if (typeof window !== 'undefined') {
            enableIndexedDbPersistence(db).catch((err) => {
                if (err.code === 'failed-precondition') {
                    console.warn("Multiple tabs open, persistence can only be enabled in one tab at a time.");
                } else if (err.code === 'unimplemented') {
                    console.warn("The current browser doesn't support all of the features required to enable persistence");
                }
            });
        }
    } catch (e) {
        console.error("Firebase initialization failed:", e);
        firebaseError = e instanceof Error ? e.message : "Firebase 초기화 중 알 수 없는 오류가 발생했습니다.";
        isDemoMode = true;
    }
}

export { db, auth, firebaseError, isDemoMode };
