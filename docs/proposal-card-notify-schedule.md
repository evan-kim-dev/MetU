# 제안: 카드 알림 → 남은 예산 기준 일정 재조정

> 상태: **제안** · 핵심 파이프는 이미 코드에 있음 · 일정 JSON 자동 덮어쓰기는 하지 않음(Suggestion 수락 전)  
> 작성 기준: 현재 코드 사실. 문서와 코드가 다르면 코드가 우선.

## 한 줄

카드 알림으로 지출이 확정될 때마다 **쓴 돈·남은 예산**을 보고, 남은 여행 일정(추정비)을 줄이거나 빼는 **재조정 제안**을 띄워요. 사용자가 수락하기 전에는 일정을 바꾸지 않아요.

---

## 1. 현재 코드 사실 (이미 있는 것)

카드/지출 확정 후 재조정 **Suggestion** 경로가 이미 있습니다.

| 단계 | 파일 | 동작 |
|------|------|------|
| 지출 확정 후 도메인 이벤트 | `lib/agent/run.ts` | `expense_changed` → `maybeSuggestRebalance` |
| 인박스 확인 후 | `confirmEventReviews` | 지출 저장 뒤 `expense_changed` 이벤트 생성 |
| 제안 생성 | `lib/agent/rebalance-run.ts` | open rebalance 1건만 · 일정 JSON 미변경 |
| 순수 감축안 | `lib/agent/rebalance-agent.ts` | variance > 15% 이면 남은 PlanItem 비례 감축 |
| UI | `OpenBudgetSuggestionCard` · 가계부 기록 단계 | 제안 수락/무시 |
| 수락 | `lib/agent/accept-suggestion.ts` | 수락 시에만 일정/예산 반영 |

**정책:** Budget-first · 에이전트는 자동으로 일정을 덮어쓰지 않아요. `lib/agent/policy.ts` / Suggestion-only 와 동일.

**금액:** LLM·클라이언트가 계산하지 않아요. `variance` · `cutRemainingPlanItems` 등 순수 함수 + 서버 RPC.

---

## 2. 이번 제안이 보태는 것

지금 감축안은 **카테고리 추정비를 깎는 것**이 중심이에요.  
제품 문장(“카드 알림 들어올 때마다 … 일정을 바꿔준다”)에 맞게 아래를 명확히 해요.

### 2.1 트리거 스토리 (발표·UX)

1. 카드 알림 → 수집 → 확인함에서 지출 확정 (또는 조건 충족 시 확정 경로)
2. 서버가 **총예산 − 확정 지출 = 남은 예산** 재계산
3. 남은 일정 추정 합이 남은 예산을 넘으면 **재조정 제안** 1건
4. 알림: “식비가 예산보다 많이 나갔어요. Day3 이후 일정을 줄여 볼까요?”
5. 사용자가 수락 → 그때만 `daily_schedule` 반영

### 2.2 고도화 아이디어 (미구현 · 후속)

| 우선 | 내용 |
|------|------|
| A | 카드 확정 직후 카피에 **남은 예산·초과 카테고리**를 더 또렷이 (기존 Suggestion payload 확장) |
| B | 추정비만 깎지 말고, 남은 예산이 크게 부족하면 **일정 항목 드롭/대체 후보** (명소 유지·식사·액티비티 후보) |
| C | Day 단위 “오늘 쓸 수 있는 돈”과 연동 (`today-budget` + 재조정 제안 딥링크 `?step=record`) |
| D | 같은 날 여러 카드 알림 → digest 알림 (`notify.ts`) 으로 묶기 |

자동 적용(수락 없이 일정 변경)은 **하지 않음**. 취소·삭제성·큰 변경은 항상 `review` / Suggestion.

---

## 3. 목표 UX

- 가계부 기록 단계: 기존처럼 `OpenBudgetSuggestionCard` (rebalance)
- 푸시/인앱 알림: “예산이 빠듯해졌어요 → 일정 조정 제안 보기”
- 수락 전 미리보기: 조정 로그(`adjustmentsLog`) · 전/후 추정 합
- 수락 후: 일정 화면에서 Day별 cost 반영 · 가계부 예산 막대 갱신

이모지 없이 lucide · 한국어 해요체 · 터치 44px.

---

## 4. 데이터·보안

- 외부 문자/알림 본문은 **데이터**. 시스템 프롬프트에 넣지 않음. `redactSms` 후 LLM(필요 시).
- 재조정 **숫자 계산은 순수 함수만** (`variance`, `cutRemainingPlanItems` …).
- LLM을 쓸 경우: “어느 항목을 줄일지 설명/후보 문장”만. 금액·분담·환율 계산 금지.
- 쓰기: `agent_create_suggestion` / accept RPC · `p_actor` 멤버십 검증 · service_role 경유는 `lib/agent/admin.ts`만.
- 멱등: open rebalance 1건 유지(이미 `open-exists` 가드). 카드 이벤트는 기존 `idempotency_key`.

---

## 5. 구현 Phase (제안)

| Phase | 내용 | 파일 힌트 |
|-------|------|-----------|
| **0 (현재)** | 지출 확정 → rebalance Suggestion | `rebalance-run.ts`, `rebalance-agent.ts` |
| **1** | 카드 확정 UX 카피·남은 예산 한 줄 · 데모 스크립트 | `OpenBudgetSuggestionCard`, `docs/demo-checklist` |
| **2** | 항목 드롭/대체 후보 순수 함수 + vitest · `rebalance-run` 연결 | `lib/agent/card-notify-schedule.ts` (**구현됨**) |
| **3** | 수락 시 일정 구조 패치(드롭 반영) RPC/수락 핸들러 | `accept-suggestion.ts` |
| **4** | digest 알림 · Today 카드 연동 | `notify.ts`, RecordStep |

---

## 6. 데모·피치 한 줄

“카드 알림으로 지출이 쌓이면, 남은 예산에 맞춰 일정 조정안을 바로 띄워요. 수락하기 전에는 일정이 안 바뀌어요.”

---

## 7. 확인 필요

- [ ] SMS 확정 경로마다 `expense_changed` → `maybeSuggestRebalance`가 빠짐없이 도는지 (수동 확인)
- [ ] 15% 임계(`REBALANCE_OVER_RATIO`)를 카드 알림 UX에 그대로 쓸지
- [ ] 드롭 후보에 지도/장소 공급자(Kakao·Google) 재검색을 넣을지 (키·비용)
- [ ] 게스트에게 재조정 제안 노출 범위

## 8. 관련 파일

- `lib/agent/run.ts` · `lib/agent/rebalance-run.ts` · `lib/agent/rebalance-agent.ts`
- `lib/budget/rebalancer.ts` · `lib/budget/schedule-map.ts` · `lib/budget/engine/variance.ts`
- `lib/agent/accept-suggestion.ts` · `components/ledger/OpenBudgetSuggestionCard.tsx`
- `docs/proposal-photo-batch-cash.md` (입력 채널 고도화와 별개 · 병행 가능)
