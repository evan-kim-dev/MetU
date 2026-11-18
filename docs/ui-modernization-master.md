# MetU UI 현대화 총망라

| 항목 | 내용 |
|------|------|
| 상태 | Wave A in progress (홈·agent·globals·여행 요약 CTA 반영) |
| 작성일 | 2026-11-19 |
| 목적 | **한 번에** UI를 손볼 때의 단일 기준서 (팀·에이전트 공유) |
| 관련 | `docs/design-system.md` · `docs/edr-trip-centric-ia.md` · `docs/hallmark-audit-triage.md` · `lib/design/tokens.ts` |

이 파일이 UI 작업의 **우선 문서**다. DS는 토큰 상세, EDR은 IA·통폐합 Phase, Hallmark triage는 audit 취급만 담당한다.

---

## 1. 한 줄

**모던 = 통폐합 + `mu-*` 통일 + 레거시 슬롭 제거.**  
**글라스 = 메인이 아니라, about/온보딩에 최대 1요소.**  
장부·확인함·정산은 **Toss처럼 선명한 불투명 핀테크**.

Hallmark로 전면 리디자인하지 않는다. Hallmark는 **레거시 슬롭 회귀 체크**용 (`docs/hallmark-audit-triage.md` C3만).

---

## 2. 팀이 합의할 문장

> 모던은 화면을 유리로 칠하는 게 아니라, 입구를 줄이고 `mu-*`로 통일하는 것이다.  
> 글라스는 about 또는 온보딩 **최대 한 곳**. 가계부·정산·확인함·금액 카드에는 넣지 않는다.

반대 제안(전면 glassmorphism, purple gradient, 새 팔레트)은 이 문서와 DS를 이유로 거절한다.

---

## 3. 비주얼 시스템 (바꾸지 않는 것 / 쓰는 것)

### 3.1 쓰는 것 — `mu-*`만

| 토큰 | 용도 |
|------|------|
| `mu-bg` | 앱 배경 `#F7F8FA` |
| `mu-card` | 카드·시트 흰 면 |
| `mu-sunken` | 칩 off·스켈레톤 |
| `mu-line` / `mu-line-strong` | 보더 |
| `mu-fg` / `fg-2` / `fg-3` | 글자 |
| `mu-accent` | CTA·선택 **唯一** 액센트 `#2563EB` |
| `mu-ok` / `warn` / `err` (+ soft) | 상태 |
| `.mu-num` + `formatKRW` | 금액 |
| `components/ds/*` | AmountCard, BottomCTA, MemberChip, Stepper… |

상세: `docs/design-system.md`, `lib/design/tokens.ts`.

### 3.2 금지 (레거시 슬롭)

| 금지 | 대체 |
|------|------|
| `ai-gradient-*`, `shadow-glow` | `bg-mu-accent` / flat card |
| `backdrop-blur` / glass 패널 (업무 화면) | `bg-mu-card border-mu-line` |
| purple→blue·indigo 그라데이션 | solid `mu-accent` |
| Tailwind 기본색 `bg-blue-500`, `text-amber-*`, `bg-red-50`… | `mu-*` / `mu-ok|warn|err` |
| 임의 `#hex` / `rgb()` (토큰 밖) | `--mu-*` |
| 레거시 `brand` / `surface` / `ink` / `mint` | `mu-*` |
| 이모지 아이콘 | `lucide-react` |
| `transition-all`, width/height 애니 | `transition-colors` / `opacity` / `transform` |
| 화면당 CTA 여러 개 | `BottomCTA` 1개 |
| 카드 안 카드·배지 난립 | 한 겹 containment |

### 3.3 글라스 정책

| 허용 | 금지 |
|------|------|
| `/about` **또는** `/onboarding*` **중 한 화면**의 히어로/헤더 밴드 1개 | 가계부, 확인함, 정산, 금액 카드, 지출 목록, 여행 요약 본문 |
| 블러 약함 + 위 텍스트는 solid 배경 | 반투명 위 작은 글씨·금액 |
| `prefers-reduced-motion` / 저성능 시 블러 off | 전 앱 glass 스킨 |

---

## 4. 구조(IA) — UI와 같이 손댈 것

한 번에 UI만 칠하고 IA를 안 바꾸면 **예쁜 분산**이 된다. 최소 아래는 같은 작업 묶음에 넣는다.

**하단:** 여행 / 홈 / 내 정보 · **확인함** 상단 바 우측  

**여행 안:** 요약 → 일정 / 가계부 / 정산  
**확인함** = 대기열 1 · **가계부** = 장부 1 · **정산** = 결과  

상세 Phase: `docs/edr-trip-centric-ia.md` §8.

| UI 묶음 | EDR Phase |
|---------|-----------|
| 하단 3탭·레거시 탭 강등 | 1 |
| 상태 배지·확인함 단일 | 2 |
| 여행 요약·`/agent` 흡수 | 3 |
| LedgerTab+Journey 단일 쉘 | 4 |
| 예산 표시 분리·`+` 도우미 | 5 |
| `mu-*` 전면·슬롭 제거 QA | 7 |
| 단체 MetU 봇 채팅 | 8 (UI 후순위) |

---

## 5. “한 번에” 범위 정의

현실적으로 **한 PR에 전 레포 픽셀 퍼펙트**는 위험하다.  
아래 **Wave**로 “한 번에 체감되는 현대화”를 정의한다.

### Wave A — 보이는 모던함 (필수, 한 에픽/연속 PR)

목표: 열자마자 레거시 AI 데모 앱이 아니라 **하나의 핀테크 앱**처럼 보이게.

1. `BottomNav` 3탭 + 멧톡/보드 강등  
2. `.ai-gradient-*` / glass(업무) / 레거시 hex 블록 제거 또는 `mu`로 치환  
3. 홈·agent·trips 표면의 `brand`/`ink`/`surface` → `mu-*`  
4. 상태색 `amber`/`red`/`emerald` → `mu-ok|warn|err`  
5. 이모지 아이콘 → lucide (노출 UI)  
6. `transition-all` 제거  
7. 여행 요약 랜딩 골격 + `/agent` 리다이렉트(또는 동일 정보 흡수)  
8. 확인함 주 입구 1 + 배지 카피 통일  

**완료 체감:** “가계부 탭이 뭐예요?”가 안 나오고, 그라데이션 CTA가 없다.

### Wave B — 쉘·장부 단일화 (곧이어)

1. `LedgerTab` vs `TripJourney` 단일 쉘  
2. 일정 / 가계부 / 정산 여행 내 내비 고정  
3. 중복 Resume/NeedsReview/인박스 입구 정리  
4. 게스트·호스트 같은 트리  

### Wave C — 품질·선택 (여력)

- Hallmark triage **C2** (`docs/hallmark-audit-triage.md`)  
- about/온보딩 **유리 1요소** (팀이 원할 때만)  
- 현금 지갑 UI (EDR Phase 6)  
- Phase 8 봇 채팅 UI  

### 한 번에 하지 않는 것

- Hallmark 전수 FAIL 해소 / stamp / 중점(`·`) 전면 치환  
- SF·위성·캐릭터 전면 스킨  
- 카톡형 가계부 메인  
- 커뮤니티 리디자인  
- DS 토큰 팔레트 교체(새 브랜드 색)  

---

## 6. 손댈 파일 지도 (Wave A 중심)

에이전트·PR은 이 목록을 체크리스트로 쓴다.

### 토큰·전역

- [x] `app/globals.css` — `ai-*`를 mu solid 별칭으로 축소  
- [x] `lib/design/tokens.ts` · `app/globals.css` `--mu-*` 동기  
- [x] `lib/design/legacy-baseline.json` — Wave A 하향  

### 쉘·내비

- [x] `components/ui/BottomNav.tsx` (여행/홈/내 정보)  
- [x] `components/layout/MobileShell.tsx` (확인함 상단, ambient 제거)  
- [x] `app/profile/**` — 커뮤니티 입구 흡수 (EDR) · profile `mu` 일부  

### 홈·온보딩·에이전트 (레거시 집중지)

- [x] `app/page.tsx`  
- [x] `components/home/**`  
- [ ] `app/onboarding/**` · `components/onboarding/**` (Connect CTA 등 일부만)  
- [x] `app/agent/**` · `components/agent/**`  
- [x] `components/agent/ledger-home/**`  

### 여행·가계부 (이미 mu 많음 → 구멍만)

- [x] `components/trips/**` 요약·목록 CTA 구멍  
- [ ] `components/ledger/**` · journey (추가 구멍은 후속)  
- [x] `components/ds/**` (기준 유지)  

### 상태·카피

- [x] 확인함/배지 라벨 단일 모듈 (`lib/ledger/inbox-copy`)  
- [x] `AgentInbox` / 배너 입구 (상단 확인함)  

딥링크(`/s`, `/join`, `/agent`, `/ledger*`, `?add=`, `?step=`)는 **유지·리다이렉트**. 삭제 금지 (CLAUDE.md).

---

## 7. 화면별 룩앤필 치트시트

| 화면 | 배경 | 카드 | 강조 | 비고 |
|------|------|------|------|------|
| 여행 목록 | `mu-bg` | `mu-card`+line | accent CTA “새 여행” | flat |
| 여행 요약 | `mu-bg` | 요약 카드들 | 주 CTA 1 (다음에 할 일) | glass 금지 |
| 일정 | `mu-bg` | 리스트/맵 | 장소 추가 | |
| 가계부 | `mu-bg` | 지출 행·시트 | 추가 CTA | 금액 `.mu-num` |
| 확인함 | `mu-bg` | 제안 카드 | 승인/수정 | 상태 = mu-warn 계열 |
| 정산 | `mu-bg` | 이체 결과 | 공유·송금 | 숫자 최대 강조 |
| about/온보딩 | 예외 가능 | — | — | **glass 최대 1** |
| 프로필 | `mu-bg` | 설정 리스트 | — | 부가 링크 |

---

## 8. 상태·카피 (사용성)

통일 배지 (어디서 보든 같은 말):

| 상태 | 의미 |
|------|------|
| 자동 기록됨 | 가계부 확정, 되돌리기 가능 |
| 확인이 필요해요 | 확인함 대기 |
| 수정됨 | 사용자 보정 |
| 분담 확인 | proposal / 분담 미확정 |

금액·환율·분담은 UI가 계산하지 않는다. 서버 결과만 표시.

---

## 9. 검수 (Wave A 완료 조건)

- [ ] 하단 3탭만으로 앱 설명이 된다  
- [ ] 업무 화면에 `ai-gradient` / `backdrop-blur` / purple 그라데이션 0  
- [ ] 신규·수정 UI에 Tailwind 기본 팔레트·임의 hex 0 (`components/ds` 0 유지)  
- [ ] `legacy-baseline` 숫자가 줄었거나 해당 버킷이 개선됨  
- [ ] 화면당 주 CTA ≤ 1 (해당 플로우)  
- [ ] 모바일 375: 가로 스크롤 0, 탭 영역 44px  
- [ ] `npm run typecheck && npm run lint && npm test`  
- [ ] 딥링크 스모크: `/s`, `/join`, `?add=`, `?step=`  
- [ ] (선택) Hallmark sloplint — **C3 관련 FAIL만** 재확인, 만점 아님  

---

## 10. 작업 방식

1. `main` 직접 금지 → `refactor/ui-wave-a` (또는 동등) 브랜치  
2. 이 문서를 PR 본문에 링크  
3. Wave A를 한 에픽으로 묶되, 리뷰 가능하면 PR을 내비 / 토큰 / 홈·agent 로 쪼개도 됨 (**기준은 이 파일 하나**)  
4. Wave B는 A 머지 후  
5. 글라스 1요소는 **별도 작은 PR** + 팀 스크린샷 승인  

에이전트에게:  
`docs/ui-modernization-master.md` Wave A 기준으로 수정해. Hallmark redesign 하지 마. C1 무시, C3+목록만.

---

## 11. 문서 역할 분담

| 문서 | 역할 |
|------|------|
| **이 파일** | UI 현대화 총망라 · Wave · 파일 지도 · 팀 합의 |
| `design-system.md` | 토큰·컴포넌트 Do/Don't |
| `edr-trip-centric-ia.md` | IA·통폐합 Phase·데이터 원칙 |
| `hallmark-audit-triage.md` | audit C1/C2/C3 취급 |
| `.cursor/rules/hallmark.mdc` | Hallmark 스킬 (신규/명시적 redesign·audit만) |
