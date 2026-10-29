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
| `NEXT_PUBLIC_IOS_SHORTCUT_URL` | 온보딩 단축어 링크 |

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
npm ci
npm run dev
npm run typecheck && npm test && npm run lint && npm run build
```

## DB (개발용 Supabase)

```bash
npx supabase link --project-ref <DEV_PROJECT_REF>
npx supabase db push
```

마이그레이션 요약: `docs/migrations-audit.md`
