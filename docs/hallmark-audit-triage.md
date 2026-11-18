# Hallmark audit triage

| 항목 | 내용 |
|------|------|
| 상태 | Draft |
| 작성일 | 2026-11-19 |
| 관련 | `docs/ui-modernization-master.md` (UI 총망라), `docs/edr-trip-centric-ia.md`, `.agents/skills/hallmark`, `.cursor/rules/hallmark.mdc` |
| 감사 범위 | `app/globals.css`, `app/page.tsx`, `about`, `BottomNav`, `components/{ds,ledger,trips,layout,agent}`, `lib/design` |
| 감사 명령 | `node .agents/skills/hallmark/scripts/sloplint.mjs … --genre modern-minimal --scope app` (정적, `--render` 미실행) |
| 요약 | 34 FAIL · 1 REFLEX · 8 WARN (130 files) |

Hallmark는 **필수 할 일 목록이 아님**. MetU는 `mu-*` 앱 스크린이 본체.  
EDR 통폐합이 우선이고, 아래는 audit 결과를 어떻게 취급할지 나눈 표다.

**실행 원칙:** C3 → (여력 시) C2. C1은 하지 않음.  
승인 없이 Hallmark 전수 수정 PR을 열지 않는다.

---

## C1. 필수 아님 (무시·보류)

| Gate / 항목 | 이유 |
|-------------|------|
| **20** CSS stamp | Hallmark로 신규/리디자인할 때만 |
| **63** 중점(`·`) 메타 카피 | 한국어 UI·기존 카피 관례. 전면 치환 비용 큼 |
| **44 / 58 / 히어로·섹션 리듬** | app screen. 마케팅 랜딩 규칙과 거리 |
| **전면 테마·리스킨** | EDR: UI 스킨 변경 비범위 |
| **render 미검증 항목**을 점수 맞추려 전부 고치기 | 통폐합보다 우선순위 낮음 |

---

## C2. 선택 (여력·품질)

| Gate / 항목 | 손보면 |
|-------------|--------|
| **10a** `transition-all` / width 애니 | 속성 명시 · transform/opacity |
| **67** 작은 `uppercase` | sentence case |
| **30a** 이모지 아이콘 | lucide (프로젝트 규칙과도 정합) |
| **29** glass / backdrop-blur | solid `mu-card`로 단순화 |
| **28a** LCP lazy | 필요 시 `fetchPriority` |
| **49** 긴 클릭 라벨 | 짧게 |
| **4** 카드 중첩 (진행 바 등) | 시각만 평탄화 (구조 유지 가능) |
| **2b** gradient text | solid ink |

---

## C3. EDR·DS와 겹침 → 할 때 같이 (권장)

통폐합 Phase와 맞물리면 **여기만** 손대면 됨. Hallmark “만점”이 목표 아님.

| 항목 | 연결 Phase / DS | 할 일 |
|------|-----------------|-------|
| **2a + 레거시 `ai-gradient-*`** | Phase 7 토큰 통일 · DS Don't | gradient 제거, `mu-accent` CTA |
| **48 hex / rgba 리터럴** (레거시 블록) | Phase 7 · `mu-*` | 레거시 규칙을 토큰으로 흡수하거나 삭제 |
| **74** Tailwind `amber`/`red`/`emerald` | DS · Phase 2 상태 배지 | `mu-ok/warn/err` (+ soft)만 |
| **이중 시스템** home/agent vs ledger | Phase 1·3·4 통폐합 | 진입·쉘 합치며 레거시 클래스 퇴출 |
| 상태 배지·카피 단일 소스 | Phase 2 | Hallmark 63과 무관하게 **이름·의미**만 통일 |

---

## 참고: 감사 당시 Floor 핫스팟

| Gate | 대표 위치 |
|------|-----------|
| 2a | `app/globals.css` `.ai-gradient-bg` |
| 48 | `globals.css` 레거시 블록 · `VisitedWorldMap` arbitrary color |
| 10a | `app/page.tsx` · `LedgerDashboard` |
| 4 | `LedgerDashboard.tsx` |
| 30a | `TripsPageContent.tsx` ✈ |
| 63 | `CashPocketCard` · `TripSummaryPanel` 등 (C1) |
| 67 | `GuestExpenseEntry` · `SettleExplainSheet` |
| 20 | `globals.css` stamp 없음 (C1) |
