# MetU (BudgetTrip)

AI 여행 플래너 + 원장/에이전트. Next.js 15 App Router + Supabase.

## 환경변수

값은 `.env.example` 을 복사해 `.env.local` 에 채우세요. 시크릿은 커밋하지 마세요.

### 필수

| 변수 | 설명 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` (또는 `…_PUBLISHABLE_KEY`) | 브라우저 키 (RLS) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | 서버 admin (agent/places cache) |
| `GEMINI_API_KEY` | 에이전트·인사이트 LLM |
| `AGENT_INGEST_PEPPER` | 수집 토큰 해시 |
| `GUEST_COOKIE_SECRET` | 게스트 쿠키 HMAC (프로덕션) |
| `CRON_SECRET` | `/api/agent/sweep`, cron Bearer |

### 선택

| 변수 | 설명 |
|------|------|
| `NEXT_PUBLIC_SITE_URL` | OAuth/리다이렉트 기준 origin |
| `NEXT_PUBLIC_TRAVEL_LINKS` | `false`/`0`/`off` 이면 항공·호텔 딥링크 숨김 |
| `NEXT_PUBLIC_KAKAO_JS_KEY` / `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` | 브라우저 지도 |
| `KAKAO_REST_API_KEY` / `GOOGLE_MAPS_SERVER_API_KEY` | 장소·경로 서버 키 |
| `ROUTE_MATRIX_PROVIDER` / `OSRM_BASE_URL` | 이동시간 행렬 |
| `GEMINI_MODEL_*` / `AGENT_AUTO_*` / `FX_*` | 모델·정책·환율 튜닝 |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | 웹 푸시 |
| `NEXT_PUBLIC_DEMO_MODE` | `1` 이면 가계부의 데모 패널과 `/api/agent/demo/*` 가 켜져요. 기본 꺼짐(라우트 404). **빌드 타임 변수라 설정 후 재배포 필요** |
| `DUP_CHARGE_WINDOW_MIN` | 중복 결제(DCC) 판정 창(분). 기본 10. 수수료 값이 아니에요 |
| `AGODA_CID` / `AGODA_TAG` | 호텔·항공 딥링크 제휴 id. 기본값이 코드에 있어요 |

### 스크립트 전용 (Next 런타임은 읽지 않음)

| 변수 | 설명 |
|------|------|
| `DEMO_BASE_URL` | `scripts/demo-ingest.mjs`, `npm run smoke:preview` 대상 배포 URL |
| `METU_INGEST_TOKEN` | `scripts/demo-ingest.mjs` 연결 코드(`metu-…`). 로그에 찍히지 않아요 |
| `DB_PASSWORD` (`backend/.env`) | `npm run db:push` 직접 접속 비밀번호 |

### 삭제됨 (설정하지 마세요)

| 변수 | 이유 |
|------|------|
| `BACKEND_URL` / `NEXT_PUBLIC_BACKEND_URL` | FastAPI/Render 제거 |
| `HOTELBEDS_*` | 실시간 호텔 API 제거 → Agoda 딥링크 |
| `WITHACT_API_BASE` | 체크리스트 WithAct 제거 → 로컬 상태 |
| `OPENROUTER_API_KEY` / `OPENAI_API_KEY` | Gemini로 전환 |

서버 전용 키를 `NEXT_PUBLIC_` 에 넣지 마세요. VAPID **공개** 키만 `NEXT_PUBLIC_VAPID_PUBLIC_KEY` 입니다.

## 개발

```bash
npm install   # npm ci 는 npm 11/Node 24 에서 락파일 불일치로 실패해요 (CI 도 npm install)
npm run dev
npm run typecheck && npm test && npm run lint && npm run build
```

## 스크립트 (`scripts/`)

값은 출력하지 않아요. 필요한 env 는 이름만 적었어요.

| 파일 | 용도 | 필요한 env | 실행 예 |
|------|------|-----------|---------|
| `apply-supabase-migrations.mjs` | 원격 Supabase 에 `supabase/migrations` 직접 적용 | `backend/.env` 의 `DB_PASSWORD` (또는 `SUPABASE_DB_PASSWORD`) | `npm run db:push` |
| `verify-supabase.mjs` | 테이블·인증 접근 점검 | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (`backend/.env`) | `npm run db:verify` |
| `bootstrap-new-supabase.mjs` | 새 Supabase 프로젝트 ref 로 로컬 env·적용 스크립트 설정 (한 번만) | 프로젝트 ref 인자, `.env.local` 에 `NEXT_PUBLIC_SUPABASE_*` 기록 | `node scripts/bootstrap-new-supabase.mjs <ref>` |
| `sync-vercel-supabase-env.mjs` | `.env.local` 의 Supabase 관련 값을 연결된 Vercel 프로젝트 env 로 올림 | `.env.local` 의 `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL` + Vercel CLI 로그인 | `node scripts/sync-vercel-supabase-env.mjs` |
| `gemini-smoke.ts` | Gemini Interactions API 수동 점검 | `GEMINI_API_KEY` (+ `GEMINI_MODEL_*`·`GEMINI_THINKING_*` 선택) | `npx tsx scripts/gemini-smoke.ts` |
| `gen-vapid.mjs` | 웹 푸시 VAPID 키 생성(로컬에서만, 값은 Vercel env 에) | 없음 | `node scripts/gen-vapid.mjs` |
| `demo-ingest.mjs` | 합성 문자를 `/api/ingest/sms` 로 보내는 실제 경로 스모크 | `DEMO_BASE_URL`, `METU_INGEST_TOKEN` | `node scripts/demo-ingest.mjs` |
| `preview-smoke.mjs` (+ `.test.mjs`) | 프리뷰 URL 상태 코드만 점검(본문·토큰 출력 없음) | `DEMO_BASE_URL` | `npm run smoke:preview` |
| `eval-receipts.ts` | 영수증 추출 평가(K4). `--dry` 는 라벨 스키마만 | `GEMINI_API_KEY`(실행 시), `eval/receipts/*` | `npm run eval:receipts -- --dry` |
| `clean-next.cjs` | `.next` 와 webpack 캐시 삭제(`build`·`dev:clean` 이 호출) | 없음 | `node scripts/clean-next.cjs` |
| `make-favicon.py` | 로고 이미지로 파비콘·앱 아이콘 생성 (용도 확인 필요: 원본 경로가 로컬 첨부 기준) | 없음 (Python + Pillow) | `python scripts/make-favicon.py` |

## DB (개발용 Supabase)

```bash
npx supabase link --project-ref <DEV_PROJECT_REF>
npx supabase db push
```

마이그레이션 요약: `docs/migrations-audit.md`
