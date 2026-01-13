
import { initializeApp, type FirebaseApp } from "firebase/app";
import { 
    initializeFirestore, 
    type Firestore, 
    clearIndexedDbPersistence,
    terminate
} from "firebase/firestore";
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
    firebaseError = "환경 변수 설정 미비";
} else {
    try {
        app = initializeApp(firebaseConfig);
        // 오프라인 기능을 완전히 끄고 메모리 캐시만 사용 (새로고침 시 증발하도록)
        db = initializeFirestore(app, {
            localCache: undefined 
        });
        auth = getAuth(app);
        
        // 남아있을 수 있는 오프라인 데이터베이스 강제 파괴
        clearIndexedDbPersistence(db).catch(() => {});
    } catch (e) {
        console.error("Firebase 초기화 실패:", e);
        isDemoMode = true;
    }
}

export { db, auth, firebaseError, isDemoMode };
