# BudgetTrip (Met-U)

여행 예산·일정 추천 Next.js 앱.

## 환경변수 (Places)

| 변수 | 용도 |
|------|------|
| `KAKAO_REST_API_KEY` | 국내 Kakao Local 장소 검색 (서버 전용) |
| `GOOGLE_MAPS_SERVER_API_KEY` | 해외 Google Places API (New) + Routes computeRouteMatrix (서버 전용) |
| `ROUTE_MATRIX_PROVIDER` | 이동시간 행렬: `auto`(기본), `google`, `kakao`, `osrm`, `haversine` |
| `OSRM_BASE_URL` | 선택 OSRM `/table/v1` 베이스 URL |
| `KAKAO_ROUTE_DAILY_BUDGET` | Kakao 도보/대중교통 정밀화 일일 호출 상한(프로세스별, 기본 800). 실제 쿼터는 [카카오디벨로퍼스](https://developers.kakao.com)에서 확인 |
| `PLACE_PROVIDER_OVERRIDE` | 선택. `kakao` 또는 `google` 로 공급자 강제 |
| `PLACE_ITINERARY_ENABLED` | `1` 이면 실존 장소 후보로 일정 폴백 |
| `SUPABASE_SERVICE_ROLE_KEY` | places 캐시 upsert (서버 전용) |
| `NEXT_PUBLIC_KAKAO_REST_API_KEY` | 카카오 로그아웃 URL 등 **클라이언트** 용 — Local 검색에 쓰지 않음 |
| `NEXT_PUBLIC_KAKAO_JS_KEY` | 국내 브라우저 Kakao 지도 JavaScript SDK |
| `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` | 해외 브라우저 Maps JavaScript API |
| `NEXT_PUBLIC_GOOGLE_MAP_ID` | AdvancedMarker 용 Map ID (없으면 DEMO_MAP_ID) |
| `ROUTE_MATRIX_PROVIDER` | `auto`/`google`/`kakao`/`osrm`/`haversine` (이동시간) |
| `OSRM_BASE_URL` | (선택) OSRM table API |
| `KAKAO_ROUTE_DAILY_BUDGET` | Kakao 도보/대중교통 일일 자체 상한 (기본 800) |

- Google Cloud 콘솔에서 Places API (New) 일일 쿼터 상한과 예산 알림을 설정할 것
- Kakao 무료 쿼터는 계정의 첫 번째로 카카오맵을 활성화한 앱에만 제공되므로 같은 앱의 키만 쓸 것
- `NEXT_PUBLIC_KAKAO_REST_API_KEY` 와 `KAKAO_REST_API_KEY` 는 용도가 다르므로 서버 키를 클라이언트에 노출하지 말 것
- 브라우저 Google 키는 HTTP referrer 제한 + Maps JavaScript API 만 허용
- Kakao JavaScript 키는 [JavaScript SDK 도메인] 등록 필수(포트 포함, 프리뷰 URL 은 별도 등록), 카카오맵 [사용 설정] ON
- Kakao JavaScript 키와 REST API 키는 서로 다른 키이며 REST 키를 브라우저 지도에 쓰지 않는다

## 환경변수 (Agent v2 — Vercel 서버)

| 변수 | 위치 | 설명 |
|------|------|------|
| `GEMINI_API_KEY` | Vercel 서버 | 에이전트 LLM (NEXT_PUBLIC 금지) |
| `GEMINI_MODEL_MAIN` / `GEMINI_MODEL_FAST` | 서버 | 비전·함수호출 / 빠른 추출 |
| `INTERNAL_API_SECRET` | Vercel 서버 | 내부/보호 라우트용 (필요 시) |
| `GUEST_COOKIE_SECRET` | 서버 | 게스트 쿠키 HMAC |
| `CRON_SECRET` | 서버 | `/api/agent/sweep`, cron Bearer |
| `AGENT_INGEST_PEPPER` | 서버 | 수집 토큰 해시 |
| `AGENT_AUTO_MAX_KRW` | 서버 | 자동 저장 금액 상한 (기본 300000) |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 | `lib/agent/admin.ts` 전용 권장 |
| `FX_PROVIDER_BASE_URL` | 서버 | Frankfurter (기본 api.frankfurter.dev) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_*` | 공개/서버 | 웹 푸시 |

자세한 로컬 설정은 `.env.example` 을 참고하세요.

TODO: `NEXT_PUBLIC_KAKAO_REST_API_KEY`(로그아웃 URL)와 서버 `KAKAO_REST_API_KEY` 를 가능하면 분리할 것.
