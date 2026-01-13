
import { initializeApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore, initializeFirestore, terminate, clearIndexedDbPersistence } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";

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

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    isDemoMode = true;
    firebaseError = "환경 변수가 설정되지 않았습니다. 데모 모드로 실행됩니다.";
} else {
    try {
        app = initializeApp(firebaseConfig);
        // 캐시를 사용하지 않도록 강제 설정 (Persistence: false)
        db = initializeFirestore(app, {
            localCache: undefined // v10+ 에서는 localCache를 명시적으로 해제
        });
        auth = getAuth(app);
        
        // 기존에 남아있을 수 있는 브라우저 캐시 강제 삭제
        clearIndexedDbPersistence(db).catch(err => console.error("Cache clear error:", err));
    } catch (e) {
        console.error("Firebase initialization failed:", e);
        firebaseError = e instanceof Error ? e.message : "Firebase 초기화 실패";
        isDemoMode = true;
    }
}

export { db, auth, firebaseError, isDemoMode };
