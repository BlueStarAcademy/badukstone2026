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

## Railway 배포 (프론트 1서비스 + PostgreSQL)

프로덕션 URL:

| 서비스 | URL |
|--------|-----|
| 앱 (프론트+API) | https://badukstone.up.railway.app |

| 서비스 | Root Directory | Config as Code | Dockerfile |
|--------|----------------|----------------|------------|
| `badukstone2026` | `/` | `railway.json` | `Dockerfile` (Caddy + API) |
| PostgreSQL | 플러그인 | — | 프론트 서비스에 `DATABASE_URL` 주입 |

프론트 Docker 이미지가 **정적 파일(Caddy)** 과 **Express API(내부 3001)** 를 함께 실행합니다.  
브라우저는 `https://badukstone.up.railway.app/api/...` 로만 호출하므로 CORS 문제가 없습니다.

| 서비스 (선택) | Root Directory | Config as Code | Dockerfile |
|--------|----------------|----------------|------------|
| `badukstone-api` | `/` | **`railway.api.json`** | `server/Dockerfile` |

별도 API 서비스는 선택 사항입니다. 프론트 서비스만으로 로그인·저장이 동작합니다.

주의: `server/railway.json`도 `server/Dockerfile`을 가리킵니다. API 서비스에 루트 `Dockerfile`(Caddy+SPA)이 연결되면 `/health`와 공개 포트가 꼬여 배포/헬스체크가 실패할 수 있습니다.

### 자동 배포가 동작하려면

1. **코드는 `main`에 있어야 합니다.** PR 브랜치만 푸시하면 Railway는 배포하지 않습니다.
2. 각 서비스 Settings에서 **Source**가 `BlueStarAcademy/badukstone2026` + 브랜치 `main` 인지 확인하고 **Autodeploy**를 Enable 합니다.
3. GitHub → Settings → Integrations → **Railway** 앱이 이 저장소에 접근 가능한지 확인합니다.
4. Railway **Wait for CI**를 켠 경우, `CI` 워크플로만 성공하면 됩니다. (토큰이 필요한 별도 Deploy Actions는 사용하지 않습니다.)

### 프론트 서비스 환경 변수 (필수)

502 Bad Gateway가 나오면 **아래 변수가 프론트 서비스에 없는 경우**가 대부분입니다.

| 변수 | 설정 방법 |
|------|-----------|
| `DATABASE_URL` | PostgreSQL 플러그인 → **Connect** → `badukstone2026`(프론트) 서비스 선택 → Reference 추가 |
| `JWT_SECRET` | 임의의 긴 문자열 (직접 입력) |
| `MASTER_EMAIL` | 마스터 로그인 아이디 |
| `MASTER_PASSWORD` | 마스터 로그인 비밀번호 |

**삭제할 변수:** `VITE_API_URL`에 `https://badukstone-api-production...` 이 있으면 제거 후 재배포

**선택:** `API_UPSTREAM` — 기본 `http://127.0.0.1:3001` (같은 컨테이너 API)

배포 로그에 `API is healthy` 가 보이면 정상입니다. `DATABASE_URL is not set` 이면 위 표대로 연결하세요.

공개 헬스체크는 `GET /health` → `{"ok":true}` 입니다. (프론트 SPA로 rewrite하지 않습니다.)

### 별도 API 서비스를 쓸 때 (선택)

- `CORS_ORIGIN` — 추가 허용 origin
- Config-as-code = `railway.api.json`, `/health` → `{"ok":true}` 확인

### 자동배포가 안 될 때

1. Railway 대시보드에서 해당 서비스 → Deployments → **Show Skipped** 확인
2. Autodeploy가 꺼져 있으면 Enable
3. Source가 비어 있거나 CLI 업로드만 있으면: Settings → Connect Repo → `BlueStarAcademy/badukstone2026` / `main`
4. Command Palette (`Cmd/Ctrl+K`) → **Deploy Latest Commit**
5. Wait for CI가 켜져 있는데 Actions가 실패하면 배포가 대기 상태로 남을 수 있습니다. CI만 통과하는지 확인하세요.

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
