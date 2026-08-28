# 바둑학원 스톤 관리 (BadukStone)

바둑학원 스톤·미션·대회·이벤트 관리 웹 앱 (React + Vite + Railway PostgreSQL).

## 로컬 실행

**필요:** Node.js 18+, PostgreSQL

### 1. API 서버

```bash
cd server
cp .env.example .env   # DATABASE_URL 등 설정
npm install
npm run dev            # http://localhost:3001
```

### 2. 프론트엔드

```bash
# 프로젝트 루트
cp .env.example .env.local   # VITE_API_URL=http://localhost:3001
npm install
npm run dev                  # http://localhost:5173
```

`VITE_API_URL`이 없으면 데모 모드(localStorage)로 동작합니다.

## Railway 배포 (2서비스)

| 서비스 | Root | 설명 |
|--------|------|------|
| `badukstone2026` | `/` | 프론트엔드 (Dockerfile + Caddy) |
| `badukstone-api` | `/server` | API + PostgreSQL 연결 |
| PostgreSQL | 플러그인 | API 서비스에 연결 |

### API 서비스 환경 변수

- `DATABASE_URL` — PostgreSQL (플러그인 자동 주입)
- `JWT_SECRET` — JWT 서명 키
- `CORS_ORIGIN` — `https://badukstone.up.railway.app`
- `MASTER_EMAIL` / `MASTER_PASSWORD` — 마스터 계정 초기 시드

### 프론트 서비스 환경 변수

- `VITE_API_URL` — API 공개 URL (예: `https://badukstone-api.up.railway.app`)

### Firestore 데이터 이관 (1회)

```bash
cd server
# FIREBASE_SERVICE_ACCOUNT_JSON 또는 FIREBASE_SERVICE_ACCOUNT_PATH 설정
npm run migrate:firestore
```

이관된 학원 계정은 `DEFAULT_ADMIN_PASSWORD`(기본 `changeme123`)로 로그인 후 비밀번호를 변경하세요.

## 스크립트

| 명령 | 설명 |
|------|------|
| `npm run dev` | 프론트 개발 서버 |
| `npm run build` | 프론트 프로덕션 빌드 |
| `cd server && npm run dev` | API 개발 서버 |
| `cd server && npm run db:migrate` | DB 스키마 마이그레이션 |
| `cd server && npm run migrate:firestore` | Firestore → PostgreSQL 이관 |
