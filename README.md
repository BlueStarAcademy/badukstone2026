# 바둑학원 스톤 관리 (BadukStone)

바둑학원 스톤·미션·대회·이벤트 관리 웹 앱 (React + Vite + Railway PostgreSQL).

**배포는 Railway만 사용합니다.** Vercel은 사용하지 않으며 연동하지 않습니다. 프로덕션은 `main` 브랜치에 푸시(또는 머지)될 때 배포됩니다.

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

| 서비스 | Root Directory | Config as Code | Dockerfile |
|--------|----------------|----------------|------------|
| `badukstone2026` | `/` | `railway.json` | `Dockerfile` (Caddy) |
| `badukstone-api` | `/` | **`railway.api.json`** | `server/Dockerfile` |
| PostgreSQL | 플러그인 | — | API에 `DATABASE_URL` 주입 |

API Dockerfile은 모노레포 루트를 빌드 컨텍스트로 씁니다. API 서비스의 Root Directory는 `/` 이고, Settings → Config-as-code 경로를 `railway.api.json`으로 두세요. (`/server`로 두면 빌드가 깨집니다.)

### 자동 배포가 동작하려면

1. **코드는 `main`에 있어야 합니다.** PR 브랜치만 푸시하면 Railway는 배포하지 않습니다.
2. 각 서비스 Settings에서 **Source**가 `BlueStarAcademy/badukstone2026` + 브랜치 `main` 인지 확인하고 **Autodeploy**를 Enable 합니다.
3. GitHub → Settings → Integrations → **Railway** 앱이 이 저장소에 접근 가능한지 확인합니다.
4. (백업) GitHub Actions `Deploy Railway` 워크플로가 `main` 푸시마다 GitHub 소스를 재연결하고 `redeploy --from-source`로 최신 커밋을 배포합니다. 이를 쓰려면 아래 시크릿이 필요합니다.

### GitHub Actions 시크릿 (한 번만)

| Secret | 필수 | 만드는 곳 |
|--------|------|-----------|
| `RAILWAY_TOKEN` | 예 | Railway → Project Settings → Tokens → Project Token |
| `RAILWAY_API_TOKEN` | 권장 | Railway → Account → Tokens (소스 재연결용) |

GitHub 저장소 → **Settings → Secrets and variables → Actions**에 추가합니다.

시크릿을 넣은 뒤 `main`에 빈 커밋을 푸시하거나 Actions에서 **Deploy Railway** → Run workflow를 실행하세요.

### API 서비스 환경 변수

- `DATABASE_URL` — PostgreSQL (플러그인 자동 주입)
- `JWT_SECRET` — JWT 서명 키
- `CORS_ORIGIN` — `https://badukstone.up.railway.app`
- `MASTER_EMAIL` / `MASTER_PASSWORD` — 마스터 계정 초기 시드

### 프론트 서비스 환경 변수

- `VITE_API_URL` — API 공개 URL (`https://badukstone-api-production.up.railway.app`)  
  Docker 빌드 인자로 들어가므로 값을 바꾸면 **재배포**가 필요합니다.

### 자동배포가 안 될 때

1. Railway 대시보드에서 해당 서비스 → Deployments → **Show Skipped** 확인
2. Autodeploy가 꺼져 있으면 Enable
3. Source가 비어 있거나 CLI 업로드만 있으면: Settings → Connect Repo → `BlueStarAcademy/badukstone2026` / `main`  
   또는 CLI: `railway service source connect --repo BlueStarAcademy/badukstone2026 --branch main --service badukstone2026`
4. Command Palette (`Cmd/Ctrl+K`) → **Deploy Latest Commit**
5. GitHub Actions **Deploy Railway** 수동 실행 (시크릿 필요)

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
