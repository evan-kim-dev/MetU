# 데모 체크리스트 (PWA / 카드 알림 → 정산)

데모 데이터와 시뮬 알림으로 **실제 ingest 파이프라인**을 재현합니다. 가짜 DB 결과나 하드코딩 환율을 쓰지 마세요.

## 사전 (전날)

- Vercel env 확인 (값은 대시보드에서만, 레포/커밋 금지)
  - `GEMINI_API_KEY`, `SUPABASE_*`, `AGENT_INGEST_PEPPER`, `CRON_SECRET`
  - 데모용으로 `AGENT_SETTLE_COALESCE_SEC` 를 10~30 근처로 (Evan이 Vercel에서 직접 설정)
  - UI 노출: `NEXT_PUBLIC_DEMO_MODE=1`
- `npm run db:verify`
- 실기기 PWA 설치, iOS 단축어/알림 권한, 웹 푸시 권한
- 콜드스타트 완화: 시연 직전 `/api/warmup` 한 번 호출

## 시연 순서

1. 로그인 → 가계부 허브에서 **데모 모드** 펼치기 (`NEXT_PUBLIC_DEMO_MODE=1`)
2. **데모 여행 만들기** (두 번 눌러도 여행 1개 재사용)
3. **데모 알림 보내기 1~4** 또는 실제 카드/단축어 알림
4. 데모 여행 가계부에서 지출 생성·원화/환율 표시 확인
5. 정산 페이지에서 동행자 잔액 → 공유/송금 링크

대체 경로: `DEMO_BASE_URL` + `METU_INGEST_TOKEN` 으로 `node scripts/demo-ingest.mjs` (토큰은 로그에 나오지 않음).

## “3초” 주장 — 측정 방법만

숫자를 문서/UI에 박지 않습니다. 측정할 때만:

1. `POST /api/agent/demo/notify` 응답의 `startedAtMs` / `acceptedAtMs`, 또는 `demo-ingest.mjs` 표의 `ms`
2. 해당 `eventId` 로 지출 row `created_at` (또는 이벤트 `processed_at`) 과의 차이
3. 시연 스크립트에 그날 측정값을 구두로만 언급

## 장애 플랜

| 증상 | 대응 |
|------|------|
| Gemini 키/쿼터 실패 | 룰 파서(`parseCardSms`) 경로는 Gemini 없이도 동작하는지 확인 → 이벤트는 `review` 로 남을 수 있음 |
| 환율 API 실패 | 마지막 성공 환율 표시 / review — 하드코딩 rate=1 금지 |
| 알림이 안 옴 | 데모 알림 버튼 또는 `scripts/demo-ingest.mjs` |
| Supabase 지연 | 수신함·가계부 새로고침, 이벤트 status 폴링 |
| Vercel 콜드스타트 | 사전 `/api/warmup` |
| Hobby cron 한계 | [docs/agent-cron.md](./agent-cron.md) sweep 팁 (Supabase pg_cron 1~5분) |

## 보안

- `.env*`, ingest 토큰, `metu-…` 연결 코드를 커밋하지 마세요.
- 픽스처는 합성 문자열만 (`lib/ledger/sms/__fixtures__/sms.ts`).
