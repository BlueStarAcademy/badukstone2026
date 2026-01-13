
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
    firebaseError = "환경 변수가 설정되지 않았습니다. 데모 모드로 실행됩니다.";
} else {
    try {
        app = initializeApp(firebaseConfig);
        // [근본 조치 1] 오프라인 캐시(IndexedDB) 기능을 아예 사용하지 않도록 설정
        db = initializeFirestore(app, {
            localCache: undefined // v10+ 명시적 캐시 비활성화
        });
        auth = getAuth(app);
        
        // [근본 조치 2] 혹시나 브라우저에 남아있을지 모르는 기존 캐시 데이터를 강제로 파괴
        clearIndexedDbPersistence(db).catch(() => {});
    } catch (e) {
        console.error("Firebase 초기화 실패:", e);
        firebaseError = e instanceof Error ? e.message : "Firebase 초기화 실패";
        isDemoMode = true;
    }
}

export { db, auth, firebaseError, isDemoMode };
