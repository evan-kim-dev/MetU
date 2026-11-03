# V0 기준선·기반 검증 보고서 (2026-11-03 KST)

- 기준 코드: `origin/main` `eaadbb0`(C0 #71 머지 직후). 런북 기준 `c26ea15f` 이후 #70·#71 이 반영됐어요.
- 방법: 명령 실행 + 코드 읽기 + 기존 테스트 실행. **코드는 고치지 않았어요.** 실 DB 접속은 하지 않았어요.
- 환경: Windows · Node v24.11.0 · npm 11.6.1 (CI 는 Node 22)
- 표기: 심각도 **차단**(데모·핵심 흐름이 막힘) / **중요**(잘못된 동작·권한 구멍) / **사소**. "재현 필요" = 코드 읽기로 판단했고 실 DB 에서 확인이 필요한 것.

---

## 1. 명령 결과

| 명령 | 결과 | 비고 |
|---|---|---|
| `npm install` | 통과 (up to date, 679 packages) | `package-lock.json` 변경 없음 |
| `npm run typecheck` | 통과 | |
| `npm run lint` | 통과 (경고 0) | `--max-warnings 0` |
| `npm test` | 통과 — **183 파일 / 1315 tests** | 런북 기준(1314)보다 1개 많음(#70 에서 추가) |
| `npm run build` | 통과 — 정적 페이지 63/63 생성 | 더미 env 5개(CI 와 동일). ⚠ 로컬에는 `.env.local` 이 있어 Next 가 함께 로드했어요(값은 출력하지 않음). 기준선은 CI build 와 같다고 보면 돼요 |
| `npm audit` | 19건 (critical 2 · high 1 · moderate 16) | 아래 1-1. 수정하지 않음 |

### 1-1. `npm audit` 요약

| 패키지 | 심각도 | 직접/간접 | 수정 |
|---|---|---|---|
| tinypool | critical | 간접 (vitest) | 메이저 업그레이드 필요 |
| vitest | critical | 직접(dev) | 메이저 |
| postcss | high | 간접 | 메이저 |
| next | moderate | 직접 | 메이저 |
| eslint · eslint-config-next · @eslint/eslintrc | moderate | 직접(dev) | 메이저 |
| @typescript-eslint/* (5) · @eslint-community/eslint-utils · @eslint/config-array · eslint-plugin-import · eslint-plugin-jsx-a11y · minimatch · @vitest/mocker | moderate | 간접(dev) | 메이저 |
| eslint-plugin-react | moderate | 간접(dev) | 패치 가능 |

대부분 dev 도구예요. 런타임 의존성은 `next`(moderate) 하나예요. 새 의존성·업그레이드 금지 규칙이라 손대지 않았고, **확인 필요**(Evan: 해커톤 이후 처리할지).

---

## 2. 빌드 라우트 표 (O 세션 비교 기준)

`ƒ` = 동적, `○` = 정적, `●` = SSG. 라우트 100개 = 페이지 34(+`/_not-found`) · `app/api` 61 · `app/auth` 2 · 아이콘 2.

| 라우트 | 종류 | Size | First Load JS |
|---|---|---|---|
| / | ƒ | 17.2 kB | 266 kB |
| /_not-found | ƒ | 290 B | 103 kB |
| /about | ƒ | 141 B | 193 kB |
| /agent | ƒ | 14.6 kB | 273 kB |
| /agent/inbox | ƒ | 881 B | 251 kB |
| /api/account/delete | ƒ | 290 B | 103 kB |
| /api/agent/attach-unassigned | ƒ | 290 B | 103 kB |
| /api/agent/automation-status | ƒ | 290 B | 103 kB |
| /api/agent/cron/daily | ƒ | 290 B | 103 kB |
| /api/agent/demo/notify | ƒ | 290 B | 103 kB |
| /api/agent/demo/reset | ƒ | 290 B | 103 kB |
| /api/agent/demo/seed | ƒ | 290 B | 103 kB |
| /api/agent/events/[id]/assign | ƒ | 290 B | 103 kB |
| /api/agent/events/[id]/confirm | ƒ | 290 B | 103 kB |
| /api/agent/events/[id]/delete | ƒ | 290 B | 103 kB |
| /api/agent/events/[id]/dismiss | ƒ | 290 B | 103 kB |
| /api/agent/events/[id]/edit | ƒ | 290 B | 103 kB |
| /api/agent/events/[id]/retry | ƒ | 290 B | 103 kB |
| /api/agent/expenses/[id]/billed | ƒ | 290 B | 103 kB |
| /api/agent/expenses/[id]/undo | ƒ | 290 B | 103 kB |
| /api/agent/expenses/[id]/unmerge | ƒ | 290 B | 103 kB |
| /api/agent/ingest-text | ƒ | 290 B | 103 kB |
| /api/agent/onboarding | ƒ | 290 B | 103 kB |
| /api/agent/onboarding/test | ƒ | 290 B | 103 kB |
| /api/agent/sweep | ƒ | 290 B | 103 kB |
| /api/agent/tokens | ƒ | 290 B | 103 kB |
| /api/agent/tokens/[id] | ƒ | 290 B | 103 kB |
| /api/auth/guest | ƒ | 290 B | 103 kB |
| /api/buddy-chat | ƒ | 290 B | 103 kB |
| /api/budget-insight | ƒ | 290 B | 103 kB |
| /api/destination-image | ƒ | 290 B | 103 kB |
| /api/docs-checklist | ƒ | 290 B | 103 kB |
| /api/events | ƒ | 290 B | 103 kB |
| /api/events/upload | ƒ | 290 B | 103 kB |
| /api/fx | ƒ | 290 B | 103 kB |
| /api/fx/target | ƒ | 290 B | 103 kB |
| /api/ingest/notification | ƒ | 290 B | 103 kB |
| /api/ingest/sms | ƒ | 290 B | 103 kB |
| /api/itinerary/patch | ƒ | 290 B | 103 kB |
| /api/ledger/fx | ƒ | 290 B | 103 kB |
| /api/ledger/parse | ƒ | 290 B | 103 kB |
| /api/ledger/parse-text | ƒ | 290 B | 103 kB |
| /api/ledger/receipt | ƒ | 290 B | 103 kB |
| /api/ledger/receipt-url | ƒ | 290 B | 103 kB |
| /api/ledger/split-patch | ƒ | 290 B | 103 kB |
| /api/ledger/split-patch/[historyId]/undo | ƒ | 290 B | 103 kB |
| /api/ledger/split-patch/apply | ƒ | 290 B | 103 kB |
| /api/ledger/split-patch/batch | ƒ | 290 B | 103 kB |
| /api/onboarding/enrich-plan | ƒ | 290 B | 103 kB |
| /api/onboarding/session | ƒ | 290 B | 103 kB |
| /api/party-insight | ƒ | 290 B | 103 kB |
| /api/places/autocomplete | ƒ | 290 B | 103 kB |
| /api/places/search | ƒ | 290 B | 103 kB |
| /api/push/subscribe | ƒ | 290 B | 103 kB |
| /api/push/test | ƒ | 290 B | 103 kB |
| /api/recommended-deals | ƒ | 290 B | 103 kB |
| /api/route/matrix | ƒ | 290 B | 103 kB |
| /api/route/optimize | ƒ | 290 B | 103 kB |
| /api/schedule-insight | ƒ | 290 B | 103 kB |
| /api/share-target | ƒ | 290 B | 103 kB |
| /api/style-insight | ƒ | 290 B | 103 kB |
| /api/trip-tips | ƒ | 290 B | 103 kB |
| /api/users/[id] | ƒ | 290 B | 103 kB |
| /api/users/batch | ƒ | 290 B | 103 kB |
| /api/warmup | ƒ | 290 B | 103 kB |
| /api/weather-insight | ƒ | 290 B | 103 kB |
| /apple-icon.png | ○ | 0 B | 0 B |
| /auth/callback | ƒ | 290 B | 103 kB |
| /auth/logout | ƒ | 290 B | 103 kB |
| /board | ƒ | 162 B | 259 kB |
| /board/[id] | ƒ | 338 B | 252 kB |
| /board/[id]/chat | ƒ | 323 B | 199 kB |
| /checklist/[category] | ● | 17.8 kB | 250 kB |
| ↳ /checklist/flight | ● 경로 | | |
| ↳ /checklist/hotel | ● 경로 | | |
| ↳ /checklist/docs | ● 경로 | | |
| ↳ /checklist/weather | ● 경로 | | |
| /icon.png | ○ | 0 B | 0 B |
| /join/[token] | ƒ | 2.29 kB | 187 kB |
| /legal/[slug] | ● | 4.33 kB | 193 kB |
| ↳ /legal/terms | ● 경로 | | |
| ↳ /legal/privacy | ● 경로 | | |
| ↳ /legal/location | ● 경로 | | |
| ↳ /legal/opensource | ● 경로 | | |
| /login | ƒ | 4.21 kB | 188 kB |
| /notifications | ƒ | 8.01 kB | 197 kB |
| /onboarding | ƒ | 14.7 kB | 153 kB |
| /onboarding/automation | ƒ | 19.5 kB | 229 kB |
| /onboarding/result | ƒ | 11.4 kB | 225 kB |
| /onboarding/shortcut-guide | ƒ | 832 B | 206 kB |
| /opod | ƒ | 161 B | 259 kB |
| /opod/[id] | ƒ | 337 B | 252 kB |
| /opod/[id]/chat | ƒ | 324 B | 199 kB |
| /opod/dm/[peerId] | ƒ | 5.83 kB | 200 kB |
| /profile | ƒ | 16.6 kB | 215 kB |
| /s/[token] | ƒ | 3.59 kB | 201 kB |
| /share-target | ƒ | 3.76 kB | 233 kB |
| /trips | ƒ | 6.27 kB | 251 kB |
| /trips/[id] | ƒ | 11.3 kB | 270 kB |
| /trips/[id]/ledger | ƒ | 18.7 kB | 254 kB |
| /trips/[id]/ledger/connect | ƒ | 4.52 kB | 119 kB |
| /trips/[id]/ledger/inbox | ƒ | 3.11 kB | 267 kB |
| /trips/[id]/ledger/recap | ƒ | 5 kB | 214 kB |
| /trips/[id]/ledger/report | ƒ | 2.74 kB | 216 kB |
| /trips/[id]/ledger/settle | ƒ | 13.4 kB | 231 kB |
| /trips/[id]/ledger/wallet | ƒ | 4.41 kB | 214 kB |
| /trips/share/[token] | ƒ | 2.99 kB | 262 kB |
| /users/[id] | ƒ | 6.23 kB | 195 kB |

- 공유 First Load JS: 103 kB
  - chunks/1255-42d7cfaeae7b799e.js 46.3 kB
  - chunks/4bd1b696-100b9d70ed4e49c1.js 54.2 kB
  - other shared chunks (total) 2.22 kB
- Middleware: 95.8 kB

---

## 3. 기반 검증

### 3-1. 게스트 권한 (S0) — `supabase/migrations/20261103140000_guest_permissions.sql`

**객체 목록**

| 종류 | 이름 / 대상 | 내용 | 위치 |
|---|---|---|---|
| 정책 | `anon_block_insert` / trips · trip_invites · community_posts · post_comments · post_likes · party_members · party_chat_messages (+ trip_plans · budget_insight_logs 는 테이블이 없으면 건너뜀) | INSERT, RESTRICTIVE, `is_anonymous is not true` | :9-41 (존재 가드 :25) |
| 정책 | `anon_block_{insert,update,delete}` / trip_expenses · trip_expense_shares | RESTRICTIVE | :47-105 |
| 트리거 | `trip_members_guest_guard` (BEFORE UPDATE, security invoker) | 익명이 trip_id/user_id/role 바꾸면 `guest-cannot-change-membership`(42501) | :110-133 |
| 테이블 | `trip_expense_proposals` | label 1~80 · amount>0 · `^[A-Z]{3}$` · status 4종, RLS on, update/delete 정책 없음 | :138-196 |
| 트리거 | `trip_expense_proposals_pending_cap` (security invoker) | 사람당 5 · 여행당 50 → `too-many-pending`(23514) | :198-235 |
| RPC | `resolve_expense_proposal(p_id, p_decision, p_expense_id, p_reason)` | security definer, authenticated 만 | :237-328 |
| RPC | `set_expense_payer(p_expense_id, p_member_id)` | security definer, authenticated 만, `paid_by`·`updated_at` 만 갱신 | :333-386 |

- 스펙(A)~(E) 문구와는 **일치**해요. `trip_plans`·`budget_insight_logs` 는 `20260711210000` 에서 이미 drop 돼서 정책이 생기지 않아요(오류 없이 건너뜀).
- 이후 마이그레이션(`20261103200000`, `20261103210000`)은 S0 객체를 바꾸지 않아요.

**검증 SQL `supabase/verify/guest_permissions_verify.sql`**: 블록 A(읽기 전용 A1~A8), 블록 B(begin…rollback, T0~T18, T18 은 수동 SKIP), 블록 C(읽기 전용 C1~C3), 블록 D(익명 정리, 주석 처리).
- 빠진 테스트: **join claim**, 여행당 50건 상한, `not-pending`·`bad-decision`·`voided`.
- 약점: A7 기대값 주석에 이미 없는 두 테이블이 있음 · A3 에 `trip_expense_proposals_pending_cap` 없음 · T2/T4/T5 는 S0 이전 정책만으로도 통과 · T2/T5/T9/T10 은 어떤 오류든 PASS.

**앱 쪽 가드**
- `guestMayApply`(`lib/ledger/split-patch.ts:177-204`): weights/only 거부, exclude/itemExclusions 는 본인만. 422 `guest-self-only` 는 split-patch · apply · batch 3곳.
- `rejectAnonymousWrite`(`lib/security/guard.ts:14-21`, 403 `guest-readonly`): 22개 라우트가 `guardApi` 직후 호출.
- 클라이언트 직접 쓰기(`save_trip_expense` invoker, insert/update/delete)는 S0 restrictive 정책이 막아요.
- 기존 테스트: `route-inventory.test.ts` + `split-patch.test.ts` = 39/39 통과.

**라우트 인벤토리** (`lib/api/route-inventory.test.ts:8-21`): 61개 = guardApi 46 + 수집 토큰 2 + 크론 2 + 허용목록 11, 빠진 라우트 0. 핸들러가 여러 개인 4개 파일(cron/daily · sweep · tokens · push/subscribe)도 모든 핸들러가 가드를 호출해요.

| 허용목록 | 사유 | 판정 |
|---|---|---|
| auth/guest · warmup · destination-image · account/delete · share-target · places/autocomplete | — | 사유와 코드 일치 |
| fx | "no write" | 사소 — 캐시 미스 시 서비스롤로 `fx_rates` upsert (`lib/fx/server.ts:100-137`) |
| onboarding/session | "session mint" | 사소 — 실제로는 `onboarding-form` 쿠키 설정, zod 검증 없음 |
| trip-tips | "read-only" | **중요** — 인증 없이 LLM 호출(`lib/ai/trip-tips.ts:70-74`), 라우트 레이트리밋 없음, 사용자 키가 "anonymous" 로 공유(`lib/ai/chat-client.ts:33`). 일일 상한(규칙 19) 적용 여부 **확인 필요** |
| users/[id] · users/batch | "own getUser check" | **중요(사유 불일치)** — `getUser` 호출 없이 서비스롤 조회(batch 는 id 최대 100). profiles 는 원래 공개 읽기라 노출 범위는 같아요 |

### 3-2. 디자인 토대 (UX-S0)

**토큰 값**: `lib/design/tokens.ts` ↔ `app/globals.css`(`--mu-*`) ↔ `tailwind.config.ts`(`mu-*`) 의 색 17개·모션 3개·반경 4개 값이 스펙과 모두 같아요(대소문자 차이만). `.mu-num`(tabular-nums + tnum) · `.mu-root`(Pretendard, keep-all) · reduced-motion 1ms 있음.

| 차이 | 내용 | 심각도 |
|---|---|---|
| Tailwind 누락 | `mu-disabled-fg`/`mu-disabled-bg` 매핑 없음 → `Button` disabled 글자가 `mu-fg-3`(#5F6B7A), 스펙은 #8B95A1 | 사소 |
| 단일 출처 범위 | 그림자(float·sheet)·타이포 토큰은 Tailwind 에만 있음 | 사소 |
| 주석 불일치 | `tokens.ts:3-5` 는 "Tailwind 동기화를 tokens.test 가 보장"이라 했지만 테스트는 globals.css 만 봄 | 사소 |
| 레거시 그림자 | Tailwind 에 `soft·nav·glow·kakao·kakao-sm·overlay·home-fab` 남음 | D8 대상 |
| 앱 기본 배경·글자 | `globals.css:10` `bg-surface-base text-ink-body`, `app/layout.tsx:51-52` `bg-canvas`·`shadow-soft`. `mu-root` 는 Stepper·TripJourney 2곳만 | D1 대상 |

**`components/ds` 사용처** (바렐 `index.ts` import 0곳, 전부 개별 파일 import)

| 컴포넌트 | 앱 사용처 |
|---|---|
| AmountCard | settle 페이지 · MyShareCard |
| BottomCTA | settle 페이지 · TripJourney · GuestShare · GuestPay |
| EmptyState | GuestAdjust · GuestPay |
| ProgressRing | settle 페이지 |
| Sheet | AgentInbox · LedgerShell · ExpensePayerSheet · GuestExpenseEntry |
| Stepper | TripJourney |
| ToastProvider | TripJourney (마운트만) |
| **Button · ExpenseRow · MemberChip · Skeleton · StepHeader · useToast** | **앱 사용처 0** (Button·StepHeader 는 ds 내부에서만, `useToast` 호출 0 → 토스트가 실제로 뜨는 경로 없음) |

**디자인 규칙 위반 수 (테스트 제외, 발생 횟수)** — D0 래칫 기준

| 디렉터리 | 기본 팔레트 | 레거시 팔레트 | ai-gradient/shadow-glow | `[#hex]` | 10px 이하 글자 |
|---|---:|---:|---:|---:|---:|
| app/ | 22 | 158 | 4 | 0 | 2 |
| components/agent | 30 | 270 | 2 | 0 | 1 |
| components/auth | 4 | 104 | 0 | 0 | 0 |
| components/checklist | 5 | 99 | 0 | 0 | 4 |
| components/community | 9 | 315 | 0 | 0 | 10 |
| components/ds | 0 | 0 | 0 | 0 | 0 |
| components/fx | 0 | 0 | 0 | 0 | 1 |
| components/home | 8 | 141 | 2 | 1 | 4 |
| components/ledger | 41 | 205 | 0 | 0 | 5 |
| components/map | 0 | 7 | 0 | 0 | 1 |
| components/notifications | 0 | 16 | 0 | 0 | 0 |
| components/onboarding | 15 | 415 | 3 | 0 | 0 |
| components/profile | 0 | 121 | 0 | 0 | 0 |
| components/pwa | 0 | 17 | 0 | 0 | 0 |
| components/recommend | 6 | 134 | 0 | 0 | 5 |
| components/trips | 22 | 488 | 6 | 2 | 3 |
| components/ui | 15 | 184 | 13 | 4 | 3 |
| lib/ | 5 | 5 | 0 | 0 | 0 |
| **합계** | **182** | **2,679** | **30** | **7** | **39** |

- 기존 가드는 `lib/design/tokens.test.ts` 의 "ds forbidden style scan" 하나이고 **`components/ds` 만** 검사해요. from/to/via 접두사, neutral·stone·lime·teal·cyan·violet·fuchsia·rose 계열, `text-[9px]`/`text-2xs`, 레거시 팔레트는 잡지 않아요. ESLint 규칙 없음.
- `components/ui/PrimaryButton.test.tsx:19,28` 은 `ai-gradient-bg` 가 **있어야** 통과해요 → D0 가 가드를 넓히면 충돌.

### 3-3. 여정 (UX-S1) — `lib/ledger/journey-state.ts` · `TripJourney.tsx`

- 호스트 키·라벨: connect 연결 · invite 초대 · record 기록 · adjust 분담 · settle 정산 · pay 송금 ✓ (adjust 표시 라벨은 "분담 (선택)").
- 게스트 키: share 내 몫 · adjust 조정 · pay 송금 · done 완료.
- 호스트 기본 단계 규칙 9개 중 1·3·5·6·7·9 는 스펙과 같아요. 차이는 아래 표.

| # | 스펙 | 코드 | 심각도 |
|---|---|---|---|
| M1 | 규칙 8: 제안 대기 > 0 → record | 함수는 맞지만 `TripJourney.tsx:145` 가 `pendingProposalCount: 0` 하드코딩 → 제안 attention·배지·규칙 8 이 동작 안 함 | 중요 |
| M2 | 규칙 2: 정산 completed → 리캡(pay 완료) | `pay` 를 반환하고 현재 칸이라 `current` 로 표시. 리캡 화면 없음(설정 시트 링크로만) | 중요 |
| M3 | connect 완료 = 연결됨 **또는 자동 기록 ≥1** | 연결됨만 봄(입력 타입에 자동 기록 수 없음) | 중요 |
| M4 | 지출 0 & 미연결 → connect | `ready` 가 자동화 상태 로딩을 기다리지 않아 늦게 오면 기본 단계가 URL 에 다른 값으로 고정될 수 있음 | 중요 |
| M5~M8 | 라벨 "(선택)", 송금 0건 pay 판정, pay 칸 attention, "확인 필요" 에 received/processing/failed 포함 | | 사소 |

**호스트 step × `LedgerShell` 표시** (`components/ledger/LedgerShell.tsx`, 공통: 합계·인박스 링크·설정 버튼·설정 시트·ExpenseConfirmSheet)

| step | 조건 | 보이는 것 | 비고 |
|---|---|---|---|
| connect | `showConnect` (:195) | "알림을 연결해요" + 연결 관리 링크 + "나중에 직접 입력할게요"(→ invite) (:268-290) | 별도 연결 상태 카드 없음 |
| invite | `showInvite` (:196) | `TripInvitePanel` + 멤버 목록 (:292-314) | |
| record | `showRecord` (:197) | 직접 입력 · `PasteExpenseBox` · `ReceiptUploader` · `VoiceInputButton` · `LedgerDashboard` · 링크 줄 · 취소 안내 · 지출 목록 (:331-408) | **NeedsReviewCard·ProposalInbox 는 렌더하지 않음**(인박스 배지만) |
| adjust | `showAdjust` (:198) | `SplitBatchBox` + 지출 목록 (:414-418) | |
| settle | `showSettleLink` (:199) | "이 금액으로 정산해요" + 정산 화면 링크 (:422-437) | |
| pay | `showSettleLink` | 제목만 "송금을 챙겨요", 나머지 settle 과 같음 | 송금 목록·완료·리캡 없음, CTA 와 링크 중복 |

→ 런북 판단 "호스트 단계 UX-S2~S6 미추출(LedgerShell 게이팅)"이 **맞아요**. `LedgerShell` 의 guestReadonly 분기는 `TripJourney` 가 게스트에게 LedgerShell 을 렌더하지 않아서 실제 화면에선 도달하지 않아요(테스트에서만).

**게스트 컴포넌트**: `GuestShare`(68줄, MyShareCard + "왜 이 금액?" + "틀린 게 있어요" + 송금 CTA) · `GuestAdjust`(40줄, 안내 + `?step=record` 링크) · `GuestPay`(48줄, 송금 목록·완료 버튼 없이 정산 페이지로 이동) · `GuestDone`(24줄, "리캡 보기" 가 `/ledger/report` 로 감 — 리캡은 `/ledger/recap`).

### 3-4. 게스트 합류 (#47) — `/join/[token]` · `/s/[token]` · `lib/auth`

- `/join` 흐름: 공개 경로 → "가입 없이 참여" → `signInAnonymously()`(:76, 실패 시 한국어 안내 + 로그인 링크 유지, 테스트 있음) → `preview_trip_invite` → 기존 이름 claim 또는 새 이름(1~20자) → `join_trip` → `afterJoinTrip` → `/trips/<id>/ledger`. 스펙 순서와 같아요.
- 토큰·QR 값은 로그에 남지 않아요(오류 메시지만). 토큰은 `/login?next=` 쿼리에는 들어가요.
- `/s/[token]`: 인증 없음, 브라우저에서 `get_shared_settlement_detail` 호출, 송금·지출(최대 200)·합계 대조 표시, noindex.
- "게스트"가 두 가지예요: ① Supabase 익명 세션(`/join`, `user.is_anonymous`) ② 쿠키 둘러보기(`provider==="guest"`, `/api/auth/guest` 7일 HMAC 쿠키). 익명 로그인되면 ②쿠키를 지워요.
- 초대 기본값: UI 24시간·4명(`TripInvitePanel.tsx:9-11`), SQL 기본값 72시간·10명(`trip_ledger_core.sql:426-427`), 허용 1~168시간·1~50명. 토큰 64 hex, DB 에는 SHA-256 만.

---

## 4. 발견한 문제 (심각도순, 고치지 않음)

### 차단

| ID | 문제 | 근거 | 영향 |
|---|---|---|---|
| **X1** | **익명 게스트가 미리 만들어 둔 이름(claim)으로 합류하면 실패해요.** `join_trip`(security definer)이 `trip_members.user_id` 를 null → 게스트 uid 로 UPDATE 하는데, S0 BEFORE UPDATE 트리거가 `auth.jwt()->>'is_anonymous'`(definer 안에서도 요청 JWT 그대로)로 `user_id` 변경을 막아 42501 → 전체 롤백 | `trip_ledger_core.sql:553-558`, `guest_permissions.sql:117-122`, 앱 `app/join/[token]/page.tsx:157-160` | 데모 폴백 "호스트가 게스트 이름을 미리 추가 → 게스트가 claim" 이 막힘. 새 이름 합류는 정상. **재현 필요**(검증 SQL 에 claim 테스트 없음) |
| **X2** | **게스트가 adjust·pay 단계에 머물 수 없어요.** 게스트 키 `adjust`·`pay` 가 호스트 키와 겹쳐서 `isHostStepKey` 가 true → `router.replace` 로 기본 단계로 되돌림 | `TripJourney.tsx:170-175`, `journey-state.ts:279-281` | GuestShare 의 송금·"틀린 게 있어요"·Stepper 탭이 무력. pay 가 기본 단계일 때만 보임 |
| **X3** | **게스트가 「내가 냈어요」·내 몫 조정에 도달할 수 없어요.** `GuestAdjust` 의 `?step=record` 도 같은 이유로 되돌려지고, `GuestExpenseSlot` 은 게스트에게 렌더되지 않는 `LedgerShell` 안에만 있음 | `GuestAdjust.tsx:19,23`, `LedgerShell.tsx:318-324` | 데모 장면 4(게스트 "저는 술 안 마셨어요")·K14 제안 흐름이 화면에서 막힘 |

### 중요

| ID | 문제 | 근거 |
|---|---|---|
| I1 | 분담 되돌리기 라우트가 익명을 막지 않음. RPC 는 여행 멤버면 통과 → 게스트가 호스트의 분담 변경을 되돌릴 수 있음. 테스트는 `rejectAnonymousWrite` 를 모킹하지만 라우트가 import 하지 않음 | `app/api/ledger/split-patch/[historyId]/undo/route.ts:22-27`, `20261103120000_split_patch_history.sql:252-263` |
| I2 | 여행당 대기 제안 50건 상한이 게스트에게 작동 안 함(security invoker 트리거의 count 가 RLS 로 자기 제안만 셈) — **재현 필요** | `guest_permissions.sql:201, 218-225, 170-174` |
| I3 | 트리거가 `is_owner` 를 보호하지 않음. 본인 행 UPDATE 로 "호스트" 표시·기본 결제자 오염 가능(DB 권한 상승은 없음) — **재현 필요** | `guest_permissions.sql:118-120`, `rls_initplan_hot.sql:49-51`, `lib/ledger/supabase.ts:26-35` |
| I4 | `trip-tips` 가 인증 없이 LLM 호출, `users/[id]`·`users/batch` 사유 불일치 | 3-1 표 |
| I5 | M1~M4 (여정 상태 계산) | 3-3 표 |
| I6 | 로그인한 비소유 동행자도 role=host 로 처리(연결 CTA 노출) | `TripJourney.tsx:52-53` |
| I7 | `TripJourney` 의 지출 수·"내 몫"에 취소(voided) 지출 포함 → GuestShare 금액이 정산과 다를 수 있음 | `lib/ledger/supabase.ts:43, 81-89` vs `settle/page.tsx:124` |
| I8 | 게스트 pay/done 판정이 '내 송금'이 아니라 여행 전체 기준 | `journey-state.ts:207-222` |
| I9 | LedgerShell 에서 지출 저장 후 `TripJourney` 가 다시 조회하지 않아 스테퍼가 갱신 안 됨 | `TripJourney.tsx:128, 271` |
| I10 | `/join` 오류 상태 하나로 이름 검증·합류 실패 시 폼이 사라지는 막다른 화면 | `app/join/[token]/page.tsx:138-168` |
| I11 | 초대 사용 횟수가 기존 멤버 확인 **전에** 증가 + "참여하기" 버튼 연타 방지 없음 → 4명 한도가 빨리 소진 | `trip_ledger_core.sql:533-551`, `page.tsx:232-237` |

### 사소

- `set_expense_payer` 가 열린 정산을 stale 로 표시하지 않음(클라이언트 basis hash 로는 감지됨).
- `resolve_expense_proposal` 이 권한 검사 전에 not-found/not-pending 을 반환.
- pending 상한 트리거에 잠금 없음(동시 INSERT).
- 익명이 쓸 수 있는 테이블: `trip_cash_rates`(돈 관련, 검토 필요), comment_likes·dm·friendships·notifications·storage.
- `/join`: 무효 초대여도 익명 계정이 먼저 생김 · 이미 멤버인데 소진 링크면 "만료"만 · Supabase 클라이언트 없으면 조용히 끝남 · claim 지정 초대에서도 모든 claimable 노출 · 익명의 `afterJoinTrip` → attach-unassigned 403(경고만).
- `/s`: stale 이 "진행 중"으로 표시 · 공유 토큰 만료 검사 없음.
- 미들웨어가 공개 경로(`/s`·`/join`)에서도 인증 조회(`middleware.ts:75-97`, `route-access.ts:36-37` 주석과 다름).
- 검증 SQL 의 빈틈(3-1).
- 디자인 토큰 차이(3-2).
- 게스트 키 목록이 `TripJourney` 에 하드코딩(값은 같음), `TripJourney.test` 에 게스트 케이스 없음.

---

## 5. 코드가 문서(런북)와 다른 점

| 항목 | 문서 | 코드 |
|---|---|---|
| 기준 커밋 | `c26ea15f` | `eaadbb0` (#70: `/agent` 저장 선택 복원·「목록으로」·DevCurlFold dev 전용 등) |
| 테스트 수 | 1314 | 1315 |
| 초대 기본값 | 24시간·4명 | UI 는 같음, SQL 기본값은 72시간·10명 |
| adjust 라벨 | 분담 | 분담 (선택) |
| record 단계 | NeedsReviewCard·ProposalInbox 표시 | 렌더 안 함 (인박스 배지만) |
| 정산 completed | 리캡 화면 | pay 단계 그대로 |
| connect 완료 | 연결 또는 자동 기록 ≥1 | 연결만 |
| GuestDone 리캡 | 리캡 | `/ledger/report` 로 링크 |
| ds 12개 | U/D 가 사용 | 6개는 앱 사용처 0 |
| `tokens.ts` 주석 | Tailwind 동기화 테스트 | 테스트는 globals.css 만 |
| 인벤토리 사유 | fx no write · session mint · own getUser | 3-1 표 |
| `app/auth/{callback,logout}` | 런북 §6 미기재 | C0 커버리지 표에서 O6·Q1 배정 |

---

## 6. Evan 확인 필요 (에이전트가 할 수 없는 일)

- [ ] Supabase SQL editor 에서 `supabase/verify/guest_permissions_verify.sql` **블록 A** 실행 → S0(`20261103140000`) 적용 여부 확인. 미적용이면 `npm run db:push`(로컬 DB env 필요) 후 **블록 B~C** 실행, 결과를 이 PR 에 코멘트(키·토큰 제외). `npm run db:verify` 는 DB 접속 정보가 필요해서 에이전트가 실행하지 않았어요.
- [ ] **X1 재현**: 블록 B 와 같은 방식(begin…rollback)으로 호스트가 `user_id` 없는 멤버를 만들고, 익명 게스트 JWT 로 `join_trip(token, <그 멤버 id>, null)` 호출 → `guest-cannot-change-membership` 이 나는지.
- [ ] I2(여행당 50건 상한)·I3(`is_owner` 자기 수정) 재현.
- [ ] Authentication → **Allow anonymous sign-ins** 켜짐, 익명 로그인 IP당 한도(행사장 와이파이 공유 IP), CAPTCHA 꺼짐 확인.
- [ ] `trip-tips`(인증 없는 LLM 호출)의 일일 상한·비용 위험 판단.
- [ ] `npm audit` 19건 처리 시점 결정.
- [ ] 이 보고서의 **차단 X1~X3** 를 U/B 앞 수정 세션으로 끼울지 결정 (런북 V0 체크포인트).
