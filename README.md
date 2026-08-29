# 바둑학원 스톤 관리 (BadukStone)

바둑학원 스톤·미션·대회·이벤트 관리 웹 앱 (React + Vite + Railway PostgreSQL).

**배포는 Railway만 사용합니다.** Vercel은 사용하지 않습니다.

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

프로덕션 URL:

| 서비스 | URL |
|--------|-----|
| 프론트 | https://badukstone.up.railway.app |
| API | https://badukstone-api-production.up.railway.app |

| 서비스 | Root | 설명 |
|--------|------|------|
| `badukstone2026` | `/` | 프론트엔드 (Dockerfile + Caddy) |
| `badukstone-api` | `/server` | API + PostgreSQL 연결 |
| PostgreSQL | 플러그인 | API 서비스에 연결 |

`main` 브랜치에 푸시하면 Railway가 프론트·API를 자동 배포합니다.

### API 서비스 환경 변수

- `DATABASE_URL` — PostgreSQL (플러그인 자동 주입)
- `JWT_SECRET` — JWT 서명 키
- `CORS_ORIGIN` — `https://badukstone.up.railway.app`
- `MASTER_EMAIL` / `MASTER_PASSWORD` — 마스터 계정 초기 시드

### 프론트 서비스 환경 변수

- `VITE_API_URL` — API 공개 URL (`https://badukstone-api-production.up.railway.app`)

### Firestore 데이터 이관 (1회)

```bash
cd server
# FIREBASE_SERVICE_ACCOUNT_JSON 또는 FIREBASE_SERVICE_ACCOUNT_PATH 설정
npm run migrate:firestore
```

이관된 학원 계정은 `DEFAULT_ADMIN_PASSWORD`(기본 `changeme123`)로 로그인 후 비밀번호를 변경하세요.

## Vercel 연결 해제 (한 번만)

이 저장소는 예전에 Vercel과 연동되어 있었습니다. `vercel.json`으로 Git 자동 배포는 꺼 두었지만, 대시보드에서 프로젝트 연결을 끊는 것이 좋습니다.

1. [Vercel Dashboard](https://vercel.com/dashboard) → `badukstone` 프로젝트
2. **Settings → Git** → Disconnect
3. 또는 프로젝트 삭제
4. GitHub → 조직/저장소 **Settings → Integrations / GitHub Apps**에서 Vercel 앱 접근 권한도 정리

## 스크립트

| 명령 | 설명 |
|------|------|
| `npm run dev` | 프론트 개발 서버 |
| `npm run build` | 프론트 프로덕션 빌드 |
| `cd server && npm run dev` | API 개발 서버 |
| `cd server && npm run db:migrate` | DB 스키마 마이그레이션 |
| `cd server && npm run migrate:firestore` | Firestore → PostgreSQL 이관 |
