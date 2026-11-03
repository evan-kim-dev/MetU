# 데모 체크리스트 (PWA / 카드 알림 → 정산)

데모 데이터와 시뮬 알림으로 **실제 ingest 파이프라인**을 재현합니다. 가짜 DB 결과나 하드코딩 환율을 쓰지 마세요.

## 사전 (전날)

- Vercel env 확인 (값은 대시보드에서만, 레포/커밋 금지)
  - `GEMINI_API_KEY`, `SUPABASE_*`, `AGENT_INGEST_PEPPER`, `CRON_SECRET`
  - 데모용으로 `AGENT_SETTLE_COALESCE_SEC` 를 10~30 근처로 (Evan이 Vercel에서 직접 설정)
  - UI 노출 + 데모 라우트: `NEXT_PUBLIC_DEMO_MODE=1` (`.env.example` 참고)
    - **빌드 타임 변수**예요. Vercel 에 설정/변경한 뒤 **재배포**해야 반영돼요.
    - 꺼져 있으면(기본) 패널이 안 보이고 `/api/agent/demo/seed`·`notify`·`reset` 는 404 를 돌려줘요.
- `npm run db:verify`
- 실기기 PWA 설치, iOS 단축어/알림 권한, 웹 푸시 권한
- 콜드스타트 완화: 시연 직전 `/api/warmup` 한 번 호출

## 데모 대본 v2 (밍글링 hero)

합성 에셋 안내는 [demo-assets.md](./demo-assets.md). 성능 숫자("N초 만에")는 말하지 않아요.

1. **호스트**: 데모 모드 → **밍글링 데모 만들기** → **합성 알림 1**(저녁) → 지출 자동 기록. (선택) 합성 영수증 업로드로 품목 채움
2. **호스트**: **초대 QR 열기** → 게스트 폰 스캔 → "가입 없이 참여" → 이름/민수 claim
3. **게스트**: "저는 술 안 마셨어요" → 미리보기 → 확정  
   - 품목 없으면 **칩/전체 제외(exclude)** 로 대체
4. **호스트**: **합성 알림 2**(2차 카페) → 지출 카드의 **민수 칩 탭 → 제외 → 확정**(되돌리기도 한 번)
5. *(선택, K14 병합 시)* 게스트: "내가 냈어요" 택시 → 호스트 승인함에서 승인
6. **호스트**: "정산 계산하기"
7. **게스트**: "내 몫" 카드 → 토스/카카오 열기 → 송금 완료
8. **호스트**: 정산 현황 → 필요 시 **데모 초기화** 후 다시 시드

### 폴백

| 증상 | 대응 |
|------|------|
| 익명 로그인 실패 | 호스트가 이름으로 멤버 추가 + 공유 링크 |
| 영수증 품목 없음 | ③을 칩/exclude 경로로 대체 |
| 정산 stale | "정산 다시 계산하기" 한 번 더 |
| 게스트 제안 지연 | ⑤ 생략 |
| Gemini 키/쿼터 실패 | 룰 파서(`parseCardSms`) 경로 확인 → 이벤트는 `review` 가능 |
| 환율 API 실패 | 마지막 성공 환율 표시 / review — 하드코딩 rate=1 금지 |
| 알림이 안 옴 | 합성 알림 버튼 또는 `scripts/demo-ingest.mjs` |
| Supabase 지연 | 수신함·가계부 새로고침, 이벤트 status 폴링 |
| Vercel 콜드스타트 | 사전 `/api/warmup` |
| Hobby cron 한계 | [docs/agent-cron.md](./agent-cron.md) sweep 팁 |

## 시연 순서 (오사카 레거시)

1. 로그인 → 가계부 허브에서 **데모 모드** 펼치기 (`NEXT_PUBLIC_DEMO_MODE=1`)
2. **오사카 데모 만들기** (두 번 눌러도 여행 1개 재사용)
3. **합성 알림 보내기 1~4** 또는 실제 카드/단축어 알림
4. 데모 여행 가계부에서 지출 생성·원화/환율 표시 확인
5. 정산 페이지에서 동행자 잔액 → 공유/송금 링크

대체 경로: `DEMO_BASE_URL` + `METU_INGEST_TOKEN` 으로 `node scripts/demo-ingest.mjs` (토큰은 로그에 나오지 않음).

## “3초” 주장 — 측정 방법만

숫자를 문서/UI에 박지 않습니다. 측정할 때만:

1. `POST /api/agent/demo/notify` 응답의 `startedAtMs` / `acceptedAtMs`, 또는 `demo-ingest.mjs` 표의 `ms`
2. 해당 `eventId` 로 지출 row `created_at` (또는 이벤트 `processed_at`) 과의 차이
3. 시연 스크립트에 그날 측정값을 구두로만 언급

## 보안

- `.env*`, ingest 토큰, `metu-…` 연결 코드를 커밋하지 마세요.
- 픽스처는 합성 문자열만 (`lib/ledger/sms/__fixtures__/sms.ts`).
- 데모 초기화는 **본인 소유 `[metu-demo:mingling]`** 여행만 지워요.
