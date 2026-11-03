# MetU — Claude Code 작업 규칙

여행 가계부·정산 PWA. 호스트가 알림/영수증으로 지출을 쌓고, 친구는 가입 없이 QR 로 들어와 자기 몫을 보고 송금한다.
(해커톤 2026 SVC Seoul AI, 하나투어 과제2.)

## 스택
Next.js ^15.1.6 (App Router, Route Handlers = BFF) · React ^19 · TypeScript strict · Tailwind ^3.4 · zod ^4
Supabase(@supabase/ssr, RLS, 익명 로그인, security definer RPC, 마이그레이션 `supabase/migrations`) · Gemini(`lib/ai/gemini.ts`, Next 서버에서만)
vitest ^3 + testing-library(jsdom) · lucide-react · @dnd-kit · web-push · qrcode · Kakao/Google 지도
경로 별칭 `@/*` = 레포 루트. 새 의존성은 꼭 필요할 때만, 이유를 PR 에 적는다. shadcn/radix/framer-motion 없음.

## 명령 (package.json 기준)
- `npm install` — **`npm ci` 쓰지 말 것**(npm 11/Node 24 에서 락파일 불일치로 실패. CI 도 npm install). `package-lock.json` 변경은 커밋하지 않는다.
- `npm run dev` · `npm run build`(= `node scripts/clean-next.cjs && next build`) · `npm run lint`(`--max-warnings 0` — 경고도 실패) · `npm run typecheck` · `npm test`(vitest run)
- build 는 더미 env 가 필요: `NEXT_PUBLIC_SUPABASE_URL` `NEXT_PUBLIC_SUPABASE_ANON_KEY` `GUEST_COOKIE_SECRET` `GEMINI_API_KEY` 에 임의 문자열(CI 와 동일). 진짜 키를 쓰지 않는다.
- PR 전 필수: `npm run typecheck && npm run lint && npm test` (UI/라우트 변경이면 `npm run build` 도).

## 절대 규칙
1. **main 에서 직접 작업 금지.** 작업마다 `git switch -c <type>/<name> origin/main`. force-push 금지. 머지는 사람이 한다.
2. `.env*`·키·토큰·비밀번호·전화번호를 읽어서 출력하거나 커밋하지 않는다. 로그에도 찍지 않는다. 비밀은 서버 env 만, `NEXT_PUBLIC_` 에 비밀 금지.
3. **딥링크·URL 유지**: `/s/[token]` `/join/[token]` `/agent` `/trips/[id]/ledger` `/trips/[id]/ledger/{inbox,connect,settle,report,recap,wallet}` `?add=receipt|manual|voice` `?settings=` `?step=`.
4. UI 문구는 **한국어 해요체**. 이모지는 UI 상태 표시에 쓰지 않고 lucide 아이콘을 쓴다.
5. 모바일 우선(360~375px), 터치 영역 44px 이상, 가로 스크롤 금지, 레이아웃 시프트 없게(스켈레톤은 실제와 같은 높이).
6. 마이그레이션은 **새 파일로만** 추가. 기존 마이그레이션 수정·DB drop 은 사용자 승인 없이 하지 않는다. 새 RPC 는 service_role/authenticated 권한을 명시.
7. 요청 범위 밖 파일을 고치지 않는다. 모르는 건 추측하지 말고 멈춰서 PR 설명/최종 답변에 "확인 필요"로 적는다. 코드와 문서가 다르면 코드가 우선, 차이를 보고한다.
8. 죽은 코드를 지울 때는 `rg -w <이름>` 으로 참조 0건(테스트 포함)을 확인한 뒤에만 지운다.

## 디자인 시스템 (`docs/design-system.md`, `lib/design/tokens.ts`)
- 토큰은 `mu-*` 만: `lib/design/tokens.ts` → `app/globals.css` 의 `--mu-*` → Tailwind `mu-*`. 컴포넌트는 `components/ds/*`.
- 팔레트: 배경 `mu-bg` #F7F8FA · 카드 `mu-card` · `mu-line` · 글자 `mu-fg`/`mu-fg-2`/`mu-fg-3` · 액센트 **#2563EB 한 가지**(`mu-accent`) · 상태 `mu-ok/warn/err`. 라디우스 8/12/16/20. 모션 150/200/250ms, `prefers-reduced-motion` 존중.
- 금지: 임의 `#hex`, Tailwind 기본 팔레트(`bg-blue-500`, `text-gray-*` …), 레거시 팔레트(`brand/surface/ink/mint/success`), `ai-gradient-*`, `shadow-glow`, `text-[10px]`·`text-2xs/3xs`(카카오페이 `kakao-*` 만 예외).
- 금액은 `.mu-num`(tabular-nums) + `formatKRW`, 화면당 주 CTA 1개(`BottomCTA`), 카드 = 흰 면 + 1px `mu-line`(그림자는 시트/CTA/토스트만).
- 톤: 클린 모던 핀테크(Toss/Linear). 여백 넉넉, 큰 금액, 바텀시트, sticky CTA, WCAG AA 대비.

## 도메인 규칙 (`.cursor/rules/hackathon.mdc` 의 핵심)
@.cursor/rules/hackathon.mdc
- 돈은 정수 KRW. 계산은 `lib/ledger/money.ts`·`settle.ts` 순수 함수만. **LLM·클라이언트는 금액·환율·분담을 계산하지 않는다.** 서버가 재계산.
- 분담 변경: LLM 은 해석만, 서버 순수 함수(`applySplitPatch`/`computeShares`)가 계산. preview → apply → undo, `idempotencyKey`. `chipToPatch` 는 LLM 없음.
- 모든 `app/api/**/route.ts` 는 `guardApi`/`requireIngestToken`/`requireCronSecret` 중 하나 또는 허용목록(+이유). `lib/api/route-inventory.test.ts` 가 강제.
- 서비스롤 키는 `lib/agent/admin.ts` 에서만. 에이전트 쓰기는 `agent_*` security definer RPC 로만.
- 게스트: 익명 Supabase 세션 + 제한적 RLS. 게스트는 자기 것만 쓰기(`guest-self-only` 422, `guest-readonly` 403). UI 숨김은 방어가 아니라 편의 — **최종 방어는 RLS/RPC**.
- LLM 호출은 `lib/ai/gemini.ts` 한 곳, 외부 텍스트는 마스킹(`redactSms`)·"데이터"로 취급. 수수료·환율·카드 약관 수치는 코드에 확정값으로 박지 않는다.

## 폴더 지도
`app/`(페이지 34, `app/api/` 61) · `components/{ds,ui,ledger,agent,trips,onboarding,community,home,profile,auth,checklist,recommend,map,...}` · `lib/{ledger,agent,ai,security,supabase,places,route,fx,...}` · `supabase/{migrations,verify}` · `scripts/` · `docs/`
여정: `components/ledger/journey/TripJourney.tsx`(+`guest/`) · `lib/ledger/journey-state.ts`(`deriveJourney`) · 호스트 본문은 아직 `components/ledger/LedgerShell.tsx`.

## 작업 방식
- 큰 변경 전에는 계획부터(plan mode). 파일을 읽고 "현재 코드 사실"을 먼저 요약한 뒤 수정한다.
- 순수 함수는 vitest, 라우트는 인증/검증/멱등 케이스를 테스트. 외부 API(Gemini·환율·web-push)는 목킹.
- 끝나면 PR 을 만들고 **멈춘다**(머지·배포·DB 적용은 하지 않는다). PR 본문: 변경 요약 / 확인한 명령 결과 / 수동 확인 항목 / 남은 위험.
- 한 세션에서 끝내지 못한 건 "확인 필요"로 PR 에 남기고, 다른 작업으로 번지지 않는다.
