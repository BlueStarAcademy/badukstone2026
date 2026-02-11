
import { initializeApp, type FirebaseApp } from "firebase/app";
import { 
    initializeFirestore, 
    type Firestore, 
    clearIndexedDbPersistence,
    memoryLocalCache
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
        // [수정] v10+ 최신 방식으로 메모리 캐시 설정 (디스크 저장 안함)
        // [수정] ignoreUndefinedProperties: true 추가하여 undefined 값으로 인한 저장 실패 방지
        db = initializeFirestore(app, {
            localCache: memoryLocalCache(),
            ignoreUndefinedProperties: true
        });
        auth = getAuth(app);
        
        // 브라우저에 남아있을 수 있는 모든 과거 유령 데이터 삭제
        clearIndexedDbPersistence(db).catch(() => {});
    } catch (e) {
        console.error("Firebase 초기화 실패:", e);
        isDemoMode = true;
    }
}

export { db, auth, firebaseError, isDemoMode };
