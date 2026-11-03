# MetU 리팩터 지도 (refactor-map)

런북 `metu_claude_code_runbook_2026-11-03.md` 의 세션 진행 상태·파일 담당·인계를 한곳에 기록해요. **모든 세션이 끝날 때 이 파일을 갱신**해요.

- 기준 코드: 런북은 `c26ea15f`(#69) 기준이고, C0 는 `acbe196`(#70 머지 후) 에서 시작했어요. #70 차이는 진행 로그에 적었어요.
- 담당 세션 열은 런북 §6 기준이에요. `A · B` = A 가 주담당, B 가 함께.

## 세션 상태

| 세션 | 브랜치 | 상태 | PR | 메모 |
|---|---|---|---|---|
| C0 | `chore/claude-code-setup` | 완료(PR #71) | #71 | CLAUDE.md · .claude/settings.json · 이 파일 |
| V0 | `chore/baseline-audit` | 완료(PR #72) | #72 | docs/audit/baseline-2026-11.md · 차단 3건 |
| B1 | `chore/dead-code-symbols` | 대기 |  |  |
| B2 | `chore/dead-routes-env-docs` | 대기 |  |  |
| B3 | `docs/db-orphans-report` | 대기 |  |  |
| U1 | `feat/ux-step-connect-invite` | 대기 |  |  |
| U2 | `feat/ux-step-record` | 대기 |  |  |
| U3 | `feat/ux-step-adjust` | 대기 |  |  |
| U4 | `feat/ux-step-settle` | 대기 |  |  |
| U5 | `feat/ux-step-pay` | 대기 |  |  |
| U6 | `feat/ux-guest-journey-complete` | 대기 |  |  |
| U7 | `feat/ux-entry-points` | 대기 |  |  |
| U8 | `feat/ux-onboarding-steps` | 대기 |  |  |
| U9 | `feat/ux-trip-flows` | 대기 |  |  |
| U10 | `feat/ux-journey-polish` | 대기 |  |  |
| D0 | `chore/design-guardrails` | 대기 |  |  |
| D1 | `refactor/design-shell` | 대기 |  |  |
| D2 | `refactor/design-home-agent` | 대기 |  |  |
| D3 | `refactor/design-ledger-rest` | 대기 |  |  |
| D4 | `refactor/design-trips` | 대기 |  |  |
| D5 | `refactor/design-onboarding` | 대기 |  |  |
| D6 | `refactor/design-community` | 대기 |  |  |
| D7 | `refactor/design-profile-misc` | 대기 |  |  |
| D8 | `chore/design-legacy-removal` | 대기 |  |  |
| O1 | `docs/perf-baseline` | 대기 |  |  |
| O2 | `perf/root-static-fonts` | 대기 |  |  |
| O3 | `perf/ledger-data-fetch` | 대기 |  |  |
| O4 | `perf/providers-client-boundary` | 대기 |  |  |
| O5 | `perf/images` | 대기 |  |  |
| O6 | `perf/middleware-cache-headers` | 대기 |  |  |
| O7 | `refactor/split-large-files` | 대기 |  |  |
| F1 | `test/stretch-completeness` | 대기 |  |  |
| Q0 | `chore/coverage-sweep` | 대기 |  |  |
| Q1 | `test/final-qa` | 대기 |  |  |

## 커버리지 표

`git ls-files` 기준 비테스트 파일 전부예요. 테스트 파일(183개)은 소유 세션이 함께 고치고, Q0 가 총량을 점검해요. 상태: 대기 → 진행 → 완료(날짜·PR).

### 페이지 (`app/**/page.tsx`) — 34개

| 경로 | 담당 세션 | 상태 |
|---|---|---|
| `app/about/page.tsx` | D7 | 대기 |
| `app/agent/inbox/page.tsx` | U2 · D2 | 대기 |
| `app/agent/page.tsx` | U7 · D2 | 대기 |
| `app/board/[id]/chat/page.tsx` | Q1 · D6 | 대기 |
| `app/board/[id]/page.tsx` | Q1 · D6 | 대기 |
| `app/board/page.tsx` | Q1 · D6 | 대기 |
| `app/checklist/[category]/page.tsx` | U9 · D7 | 대기 |
| `app/join/[token]/page.tsx` | U6 · D3 | 검증(V0, 2026-11-03, PR #72) |
| `app/legal/[slug]/page.tsx` | D1 | 대기 |
| `app/login/page.tsx` | D1 | 대기 |
| `app/notifications/page.tsx` | Q1 · D6 | 대기 |
| `app/onboarding/automation/page.tsx` | U8 · D5 | 대기 |
| `app/onboarding/page.tsx` | U8 · D5 | 대기 |
| `app/onboarding/result/page.tsx` | U8 · D5(+D7 추천영역) | 대기 |
| `app/onboarding/shortcut-guide/page.tsx` | U8 · D5 | 대기 |
| `app/opod/[id]/chat/page.tsx` | Q1 · D6 | 대기 |
| `app/opod/[id]/page.tsx` | Q1 · D6 | 대기 |
| `app/opod/dm/[peerId]/page.tsx` | Q1 · D6 | 대기 |
| `app/opod/page.tsx` | Q1 · D6 | 대기 |
| `app/page.tsx` | U7 · D2 | 대기 |
| `app/profile/page.tsx` | Q1 · D7 | 대기 |
| `app/s/[token]/page.tsx` | U6 · D3 | 검증(V0, 2026-11-03, PR #72) |
| `app/share-target/page.tsx` | U8 · D5 | 대기 |
| `app/trips/[id]/ledger/connect/page.tsx` | U1 · D3 | 대기 |
| `app/trips/[id]/ledger/inbox/page.tsx` | U2 · D2·D3 | 대기 |
| `app/trips/[id]/ledger/page.tsx` | U1~U5·U10 · D3 | 대기 |
| `app/trips/[id]/ledger/recap/page.tsx` | F1 · D3 | 대기 |
| `app/trips/[id]/ledger/report/page.tsx` | F1 · D3 | 대기 |
| `app/trips/[id]/ledger/settle/page.tsx` | U4 · D3 | 대기 |
| `app/trips/[id]/ledger/wallet/page.tsx` | F1 · D3 | 대기 |
| `app/trips/[id]/page.tsx` | U9 · D4 | 대기 |
| `app/trips/page.tsx` | U9 · D4 | 대기 |
| `app/trips/share/[token]/page.tsx` | U9 · D4 | 대기 |
| `app/users/[id]/page.tsx` | Q1 · D6 | 대기 |

### 앱 공통 파일 (`app/` 레이아웃·로딩·에러·아이콘·전역 CSS) — 28개

| 경로 | 담당 세션 | 상태 |
|---|---|---|
| `app/apple-icon.png` | D1 | 대기 |
| `app/auth/callback/route.ts` | O6 · Q1 (런북 §6 미기재, app/api 밖 인증 라우트) | 대기 |
| `app/auth/logout/route.ts` | O6 · Q1 (런북 §6 미기재, app/api 밖 인증 라우트) | 대기 |
| `app/board/[id]/loading.tsx` | U10 · D1 | 대기 |
| `app/board/error.tsx` | U10 · D1 | 대기 |
| `app/board/loading.tsx` | U10 · D1 | 대기 |
| `app/checklist/[category]/loading.tsx` | U10 · D1 | 대기 |
| `app/error.tsx` | U10 · D1 | 대기 |
| `app/favicon.ico` | D1 | 대기 |
| `app/global-error.tsx` | U10 · D1 | 대기 |
| `app/globals.css` | D8 | 검증(V0, 2026-11-03, PR #72) |
| `app/icon.png` | D1 | 대기 |
| `app/layout.tsx` | D1 · O2 | 대기 |
| `app/loading.tsx` | U10 · D1 | 대기 |
| `app/not-found.tsx` | U10 · D1 | 대기 |
| `app/notifications/loading.tsx` | U10 · D1 | 대기 |
| `app/onboarding/error.tsx` | U10 · D1 | 대기 |
| `app/onboarding/loading.tsx` | U10 · D1 | 대기 |
| `app/onboarding/result/loading.tsx` | U10 · D1 | 대기 |
| `app/opod/[id]/loading.tsx` | U10 · D1 | 대기 |
| `app/opod/error.tsx` | U10 · D1 | 대기 |
| `app/opod/loading.tsx` | U10 · D1 | 대기 |
| `app/profile/loading.tsx` | U10 · D1 | 대기 |
| `app/trips/[id]/error.tsx` | U10 · D1 | 대기 |
| `app/trips/[id]/loading.tsx` | U10 · D1 | 대기 |
| `app/trips/loading.tsx` | U10 · D1 | 대기 |
| `app/trips/share/[token]/loading.tsx` | U10 · D1 | 대기 |
| `app/users/[id]/loading.tsx` | U10 · D1 | 대기 |

### API 라우트 (`app/api/**/route.ts`) — 61개

| 경로 | 담당 세션 | 상태 |
|---|---|---|
| `app/api/account/delete/route.ts` | D7 · Q1 | 대기 |
| `app/api/agent/attach-unassigned/route.ts` | V0 · O3 | 대기 |
| `app/api/agent/automation-status/route.ts` | V0 · O3 | 대기 |
| `app/api/agent/cron/daily/route.ts` | V0 · O3 | 대기 |
| `app/api/agent/demo/notify/route.ts` | Q1 | 대기 |
| `app/api/agent/demo/reset/route.ts` | Q1 | 대기 |
| `app/api/agent/demo/seed/route.ts` | Q1 | 대기 |
| `app/api/agent/events/[id]/assign/route.ts` | V0 · O3 | 대기 |
| `app/api/agent/events/[id]/confirm/route.ts` | V0 · O3 | 대기 |
| `app/api/agent/events/[id]/delete/route.ts` | V0 · O3 | 대기 |
| `app/api/agent/events/[id]/dismiss/route.ts` | V0 · O3 | 대기 |
| `app/api/agent/events/[id]/edit/route.ts` | V0 · O3 | 대기 |
| `app/api/agent/events/[id]/retry/route.ts` | V0 · O3 | 대기 |
| `app/api/agent/expenses/[id]/billed/route.ts` | V0 · O3 | 대기 |
| `app/api/agent/expenses/[id]/undo/route.ts` | V0 · O3 | 대기 |
| `app/api/agent/expenses/[id]/unmerge/route.ts` | V0 · O3 | 대기 |
| `app/api/agent/ingest-text/route.ts` | V0 · O3 | 대기 |
| `app/api/agent/onboarding/route.ts` | V0 · O3 | 대기 |
| `app/api/agent/onboarding/test/route.ts` | V0 · O3 | 대기 |
| `app/api/agent/sweep/route.ts` | V0 · O3 | 대기 |
| `app/api/agent/tokens/[id]/route.ts` | V0 · O3 | 대기 |
| `app/api/agent/tokens/route.ts` | V0 · O3 | 대기 |
| `app/api/auth/guest/route.ts` | U6 | 검증(V0, 2026-11-03, PR #72) |
| `app/api/buddy-chat/route.ts` | O3 | 대기 |
| `app/api/budget-insight/route.ts` | O3 | 대기 |
| `app/api/destination-image/route.ts` | U9 · O3 | 대기 |
| `app/api/docs-checklist/route.ts` | O3 | 대기 |
| `app/api/events/route.ts` | U2 · U8 | 대기 |
| `app/api/events/upload/route.ts` | U2 · U8 | 대기 |
| `app/api/fx/route.ts` | U9 · O3 | 대기 |
| `app/api/fx/target/route.ts` | U9 · O3 | 대기 |
| `app/api/ingest/notification/route.ts` | U2 · U8 | 대기 |
| `app/api/ingest/sms/route.ts` | U2 · U8 | 대기 |
| `app/api/itinerary/patch/route.ts` | U9 · O3 | 대기 |
| `app/api/ledger/fx/route.ts` | U2 | 대기 |
| `app/api/ledger/parse-text/route.ts` | U2 | 대기 |
| `app/api/ledger/parse/route.ts` | U2 | 대기 |
| `app/api/ledger/receipt-url/route.ts` | F1 (확인 필요: 호출처 0, 삭제 금지) | 대기 |
| `app/api/ledger/receipt/route.ts` | U2 | 대기 |
| `app/api/ledger/split-patch/[historyId]/undo/route.ts` | U3 | 검증(V0, 2026-11-03, PR #72) |
| `app/api/ledger/split-patch/apply/route.ts` | U3 | 검증(V0, 2026-11-03, PR #72) |
| `app/api/ledger/split-patch/batch/route.ts` | U3 | 검증(V0, 2026-11-03, PR #72) |
| `app/api/ledger/split-patch/route.ts` | U3 | 검증(V0, 2026-11-03, PR #72) |
| `app/api/onboarding/enrich-plan/route.ts` | O3 | 대기 |
| `app/api/onboarding/session/route.ts` | O3 | 대기 |
| `app/api/party-insight/route.ts` | O3 | 대기 |
| `app/api/places/autocomplete/route.ts` | U9 · O3 | 대기 |
| `app/api/places/search/route.ts` | B2 (삭제 후보, Evan 로그 확인 후) | 대기 |
| `app/api/push/subscribe/route.ts` | B2 | 대기 |
| `app/api/push/test/route.ts` | B2 (확인 필요) | 대기 |
| `app/api/recommended-deals/route.ts` | U9 · O3 | 대기 |
| `app/api/route/matrix/route.ts` | B2 (삭제 후보, Evan 로그 확인 후) | 대기 |
| `app/api/route/optimize/route.ts` | U9 · O3 | 대기 |
| `app/api/schedule-insight/route.ts` | O3 | 대기 |
| `app/api/share-target/route.ts` | U2 · U8 | 대기 |
| `app/api/style-insight/route.ts` | O3 | 대기 |
| `app/api/trip-tips/route.ts` | U9 · O3 | 대기 |
| `app/api/users/[id]/route.ts` | D7 · Q1 | 대기 |
| `app/api/users/batch/route.ts` | D7 · Q1 | 대기 |
| `app/api/warmup/route.ts` | U9 · O3 | 대기 |
| `app/api/weather-insight/route.ts` | O3 | 대기 |

### 컴포넌트 (`components/**`, 테스트 제외) — 201개

| 경로 | 담당 세션 | 상태 |
|---|---|---|
| `components/agent/AgentHubContent.tsx` | D2 | 대기 |
| `components/agent/AgentInbox.tsx` | D2 | 대기 |
| `components/agent/ConnectIngestPanel.tsx` | D2 | 대기 |
| `components/agent/DemoModePanel.tsx` | D2 | 대기 |
| `components/agent/ledger-home/AutomationPill.tsx` | D2 | 대기 |
| `components/agent/ledger-home/LedgerHomeEmpty.tsx` | D2 | 대기 |
| `components/agent/ledger-home/LedgerHomeGuest.tsx` | D2 | 대기 |
| `components/agent/ledger-home/LedgerHomeSkeleton.tsx` | D2 | 대기 |
| `components/agent/ledger-home/LedgerTripPicker.tsx` | D2 | 대기 |
| `components/agent/ledger-home/MoreSheet.tsx` | D2 | 대기 |
| `components/agent/ledger-home/NeedsReviewCard.tsx` | D2 | 대기 |
| `components/agent/ledger-home/PrimaryActions.tsx` | D2 | 대기 |
| `components/agent/ledger-home/RecentExpenses.tsx` | D2 | 대기 |
| `components/agent/ledger-home/SectionRetry.tsx` | D2 | 대기 |
| `components/agent/ledger-home/SettlementSummaryCard.tsx` | D2 | 대기 |
| `components/agent/ledger-home/TripHeaderCard.tsx` | D2 | 대기 |
| `components/agent/ledger-home/TripSwitcherSheet.tsx` | U7 (확인 필요: 미연결) | 대기 |
| `components/agent/ledger-home/groupTripsForLedgerPicker.ts` | D2 | 대기 |
| `components/agent/ledger-home/ledger-home.fixtures.ts` | D2 | 대기 |
| `components/agent/ledger-home/needsReview.ts` | D2 | 대기 |
| `components/agent/ledger-home/useLedgerHomeData.ts` | D2 | 대기 |
| `components/agent/ledger-home/useSelectedTrip.ts` | D2 | 대기 |
| `components/auth/AuthGate.tsx` | D7 | 대기 |
| `components/auth/AuthGateOverlay.tsx` | D7 | 대기 |
| `components/auth/AuthMessage.tsx` | D7 | 대기 |
| `components/auth/EmailAuthForm.tsx` | D7 | 대기 |
| `components/auth/LoginContent.tsx` | D7 | 대기 |
| `components/auth/LoginMethodList.tsx` | D7 | 대기 |
| `components/auth/useAuthActions.ts` | D7 | 대기 |
| `components/checklist/DocsChecklistContent.tsx` | U9 · D7 | 대기 |
| `components/checklist/FlightChecklistContent.tsx` | U9 · D7 | 대기 |
| `components/checklist/HotelChecklistContent.tsx` | U9 · D7 | 대기 |
| `components/checklist/WeatherChecklistContent.tsx` | U9 · D7 | 대기 |
| `components/community/AuthorAvatarLink.tsx` | D6 | 대기 |
| `components/community/AuthorProfilePopup.tsx` | D6 | 대기 |
| `components/community/CommunityListPage.tsx` | D6 | 대기 |
| `components/community/DmChatPageContent.tsx` | D6 | 대기 |
| `components/community/FriendAddButton.tsx` | D6 | 대기 |
| `components/community/PartyChatPageContent.tsx` | D6 | 대기 |
| `components/community/PostCard.tsx` | D6 | 대기 |
| `components/community/PostDetailContent.tsx` | D6 | 대기 |
| `components/community/PostImageGallery.tsx` | D6 | 대기 |
| `components/community/WritePostSheet.tsx` | D6 | 대기 |
| `components/community/useCommunityListState.ts` | D6 | 대기 |
| `components/community/usePostDetailActions.ts` | D6 | 대기 |
| `components/ds/AmountCard.tsx` | D0 | 검증(V0, 2026-11-03, PR #72) |
| `components/ds/BottomCTA.tsx` | D0 | 검증(V0, 2026-11-03, PR #72) |
| `components/ds/Button.tsx` | D0 | 검증(V0, 2026-11-03, PR #72) |
| `components/ds/EmptyState.tsx` | D0 | 검증(V0, 2026-11-03, PR #72) |
| `components/ds/ExpenseRow.tsx` | D0 | 검증(V0, 2026-11-03, PR #72) |
| `components/ds/MemberChip.tsx` | D0 | 검증(V0, 2026-11-03, PR #72) |
| `components/ds/ProgressRing.tsx` | D0 | 검증(V0, 2026-11-03, PR #72) |
| `components/ds/Sheet.tsx` | D0 | 검증(V0, 2026-11-03, PR #72) |
| `components/ds/Skeleton.tsx` | D0 | 검증(V0, 2026-11-03, PR #72) |
| `components/ds/Stepper.tsx` | D0 | 검증(V0, 2026-11-03, PR #72) |
| `components/ds/Toast.tsx` | D0 | 검증(V0, 2026-11-03, PR #72) |
| `components/ds/index.ts` | D0 | 검증(V0, 2026-11-03, PR #72) |
| `components/fx/FxAttribution.tsx` | D1 | 대기 |
| `components/home/AISmartTipsShortcut.tsx` | D2 | 대기 |
| `components/home/ActiveTripCard.tsx` | D2 | 대기 |
| `components/home/ActiveTripSection.tsx` | D2 | 대기 |
| `components/home/ActiveTripSmartTips.tsx` | D2 | 대기 |
| `components/home/AutomationStatusBanner.tsx` | D2 | 대기 |
| `components/home/DealDetailSheet.tsx` | D2 | 대기 |
| `components/home/FirstRunChecklist.tsx` | D2 | 대기 |
| `components/home/GuestHomeCard.tsx` | D2 | 대기 |
| `components/home/HomeGreeting.tsx` | D2 | 대기 |
| `components/home/HomeNotificationBell.tsx` | D2 | 대기 |
| `components/home/RecommendedGrid.tsx` | D2 | 대기 |
| `components/home/SmartTips.tsx` | D2 | 대기 |
| `components/home/UnassignedInboxBanner.tsx` | D2 | 대기 |
| `components/layout/MobileShell.tsx` | D1 | 대기 |
| `components/ledger/CardProfileSettings.tsx` | D3 | 대기 |
| `components/ledger/CashRateSettings.tsx` | D3 | 대기 |
| `components/ledger/CurrencyTotals.tsx` | U4/U5 | 대기 |
| `components/ledger/ExpenseChipSplit.tsx` | U3 | 대기 |
| `components/ledger/ExpenseConfirmSheet.tsx` | D3 | 대기 |
| `components/ledger/ExpenseMemberChips.tsx` | U3 | 대기 |
| `components/ledger/ExpensePayerSheet.tsx` | U3 | 대기 |
| `components/ledger/FeeLeakCard.tsx` | U4/U5 | 대기 |
| `components/ledger/GuestExpenseEntry.tsx` | U6 | 대기 |
| `components/ledger/GuestExpenseSlot.tsx` | U6 | 대기 |
| `components/ledger/LedgerDashboard.tsx` | D3 | 대기 |
| `components/ledger/LedgerInboxClient.tsx` | D3 | 대기 |
| `components/ledger/LedgerShell.tsx` | U2 | 검증(V0, 2026-11-03, PR #72) |
| `components/ledger/MyShareCard.tsx` | U6 | 대기 |
| `components/ledger/PasteExpenseBox.tsx` | U2 | 대기 |
| `components/ledger/ProposalInbox.tsx` | U6 | 대기 |
| `components/ledger/RecapCard.tsx` | D3 | 대기 |
| `components/ledger/ReceiptUploader.tsx` | D3 | 대기 |
| `components/ledger/SettleExplainSheet.tsx` | U4/U5 | 대기 |
| `components/ledger/SettlementHistory.tsx` | U4/U5 | 대기 |
| `components/ledger/SplitBatchBox.tsx` | U3 | 대기 |
| `components/ledger/SplitPatchBox.tsx` | U3 | 대기 |
| `components/ledger/SplitPreviewSheet.tsx` | U3 | 대기 |
| `components/ledger/VoiceInputButton.tsx` | U2 | 대기 |
| `components/ledger/journey/TripJourney.tsx` | U6 · U10 | 검증(V0, 2026-11-03, PR #72) |
| `components/ledger/journey/guest/GuestAdjust.tsx` | U6 · U10 | 검증(V0, 2026-11-03, PR #72) |
| `components/ledger/journey/guest/GuestDone.tsx` | U6 · U10 | 검증(V0, 2026-11-03, PR #72) |
| `components/ledger/journey/guest/GuestPay.tsx` | U6 · U10 | 검증(V0, 2026-11-03, PR #72) |
| `components/ledger/journey/guest/GuestShare.tsx` | U6 · U10 | 검증(V0, 2026-11-03, PR #72) |
| `components/ledger/split-preview-types.ts` | U2 | 대기 |
| `components/ledger/useSettleReference.ts` | U2 | 대기 |
| `components/map/GoogleTripMap.tsx` | D4 | 대기 |
| `components/map/KakaoTripMap.tsx` | D4 | 대기 |
| `components/map/PinBadge.tsx` | D4 | 대기 |
| `components/map/TripMap.tsx` | D4 | 대기 |
| `components/map/types.ts` | D4 | 대기 |
| `components/notifications/NotificationsPageContent.tsx` | D6 | 대기 |
| `components/onboarding/AIThinkingOverlay.tsx` | U8 | 대기 |
| `components/onboarding/AirportSearchField.tsx` | U8 | 대기 |
| `components/onboarding/BudgetStep.tsx` | U8 | 대기 |
| `components/onboarding/PartyStep.tsx` | U8 | 대기 |
| `components/onboarding/ScheduleStep.tsx` | U8 | 대기 |
| `components/onboarding/StyleStep.tsx` | U8 | 대기 |
| `components/onboarding/connect/AppPicker.tsx` | U8 | 대기 |
| `components/onboarding/connect/ConnectError.tsx` | U8 | 대기 |
| `components/onboarding/connect/ConnectFlow.tsx` | U8 | 대기 |
| `components/onboarding/connect/ConnectHub.tsx` | U8 | 대기 |
| `components/onboarding/connect/ConnectStepCards.tsx` | U8 | 대기 |
| `components/onboarding/connect/DevCurlFold.tsx` | U8 | 대기 |
| `components/onboarding/connect/GateNotice.tsx` | U8 | 대기 |
| `components/onboarding/connect/GuideSideCard.tsx` | U8 | 대기 |
| `components/onboarding/connect/RecentEvents.tsx` | U8 | 대기 |
| `components/onboarding/connect/RecentEventsStrip.tsx` | U8 | 대기 |
| `components/onboarding/connect/ShortcutsAppActions.tsx` | U8 | 대기 |
| `components/onboarding/connect/StepAutomation.tsx` | U8 | 대기 |
| `components/onboarding/connect/StepCode.tsx` | U8 | 대기 |
| `components/onboarding/connect/StepDevice.tsx` | U8 | 대기 |
| `components/onboarding/connect/StepShortcut.tsx` | U8 | 대기 |
| `components/onboarding/connect/StepVerify.tsx` | U8 | 대기 |
| `components/onboarding/connect/StickyActionBar.tsx` | U8 | 대기 |
| `components/onboarding/connect/TokenReissueDialog.tsx` | U8 | 대기 |
| `components/onboarding/connect/UnsupportedHandoff.tsx` | U8 | 대기 |
| `components/onboarding/connect/useClipboardCopy.ts` | U8 | 대기 |
| `components/onboarding/guide/CopyButton.tsx` | U8 | 대기 |
| `components/onboarding/guide/DevSnippet.tsx` | U8 | 대기 |
| `components/onboarding/guide/GuideFaq.tsx` | U8 | 대기 |
| `components/onboarding/guide/GuideProgress.tsx` | U8 | 대기 |
| `components/onboarding/guide/GuideStepCard.tsx` | U8 | 대기 |
| `components/onboarding/guide/PlatformTabs.tsx` | U8 | 대기 |
| `components/onboarding/guide/ShortcutGuide.tsx` | U8 | 대기 |
| `components/onboarding/types.ts` | U8 | 대기 |
| `components/profile/ProfileContent.tsx` | D7 | 대기 |
| `components/profile/PublicProfileContent.tsx` | D7 | 대기 |
| `components/profile/useProfileContent.ts` | D7 | 대기 |
| `components/providers/AppProviders.tsx` | D1 | 대기 |
| `components/pwa/InstallBanner.tsx` | D1 | 대기 |
| `components/pwa/ServiceWorkerRegister.tsx` | D1 | 대기 |
| `components/recommend/BudgetDonutChart.tsx` | U9 · D7 | 대기 |
| `components/recommend/RecommendResult.tsx` | U9 · D7 | 대기 |
| `components/recommend/planToTrip.ts` | U9 · D7 | 대기 |
| `components/recommend/usePlanQuotes.ts` | U9 · D7 | 대기 |
| `components/trips/ItineraryChatBar.tsx` | U9 | 대기 |
| `components/trips/QuickTripSheet.tsx` | U9 | 대기 |
| `components/trips/SharedTripContent.tsx` | U9 | 대기 |
| `components/trips/SortableDayList.tsx` | U9 | 대기 |
| `components/trips/TripDetailContent.tsx` | U9 | 대기 |
| `components/trips/TripDetailParts.tsx` | U9 | 대기 |
| `components/trips/TripListCard.tsx` | U9 | 대기 |
| `components/trips/TripMapPanel.tsx` | U9 | 대기 |
| `components/trips/TripsPageContent.tsx` | U9 | 대기 |
| `components/trips/VisitedCountrySheet.tsx` | U9 | 대기 |
| `components/trips/VisitedWorldMap.tsx` | U9 | 대기 |
| `components/trips/ledger/ExpenseFlags.tsx` | U9 | 대기 |
| `components/trips/ledger/ExpenseForm.tsx` | U9 | 대기 |
| `components/trips/ledger/ExpenseFxLine.tsx` | U9 | 대기 |
| `components/trips/ledger/LedgerTab.tsx` | U9 | 대기 |
| `components/trips/ledger/MemberManager.tsx` | U9 | 대기 |
| `components/trips/ledger/NaturalExpenseInput.tsx` | U9 | 대기 |
| `components/trips/ledger/TripInvitePanel.tsx` | U9 | 대기 |
| `components/trips/useTripDetailEditor.ts` | U9 | 대기 |
| `components/ui/AIInsightBadge.tsx` | D1 | 대기 |
| `components/ui/AILoadingPanel.tsx` | D1 | 대기 |
| `components/ui/BottomNav.tsx` | D1 | 대기 |
| `components/ui/BottomSheet.tsx` | D1 | 대기 |
| `components/ui/BuildRevalidator.tsx` | D1 | 대기 |
| `components/ui/BuildStamp.tsx` | D1 | 대기 |
| `components/ui/Counter.tsx` | D1 | 대기 |
| `components/ui/DateField.tsx` | D1 | 대기 |
| `components/ui/DestinationImage.tsx` | D1 | 대기 |
| `components/ui/EasterEggCelebration.tsx` | D1 | 대기 |
| `components/ui/EasterEggToast.tsx` | D1 | 대기 |
| `components/ui/HorizontalScroller.tsx` | D1 | 대기 |
| `components/ui/MetULogo.tsx` | D1 | 대기 |
| `components/ui/OfflineBanner.tsx` | D1 | 대기 |
| `components/ui/PageSkeleton.tsx` | D1 | 대기 |
| `components/ui/PetCursorFollower.tsx` | D1 | 대기 |
| `components/ui/PrimaryButton.tsx` | D1 | 대기 |
| `components/ui/ProfileDogBuddy.tsx` | D1 | 대기 |
| `components/ui/ProgressBar.tsx` | D1 | 대기 |
| `components/ui/RouteProgress.tsx` | D1 | 대기 |
| `components/ui/SafeAvatar.tsx` | D1 | 대기 |
| `components/ui/SectionErrorBoundary.tsx` | D1 | 대기 |
| `components/ui/SectionHeader.tsx` | D1 | 대기 |
| `components/ui/SelectChip.tsx` | D1 | 대기 |
| `components/ui/SessionExpiredDialog.tsx` | D1 | 대기 |
| `components/ui/StepCard.tsx` | D1 | 대기 |
| `components/ui/TextField.tsx` | D1 | 대기 |
| `components/ui/ToggleSwitch.tsx` | D1 | 대기 |
| `components/ui/TopAppBar.tsx` | D1 | 대기 |

### 라이브러리 (`lib/**`, 테스트 제외) — 254개

| 경로 | 담당 세션 | 상태 |
|---|---|---|
| `lib/agent/admin.ts` | V0 | 대기 |
| `lib/agent/body-limit.ts` | V0 | 대기 |
| `lib/agent/domain-followup.ts` | V0 | 대기 |
| `lib/agent/event-access.ts` | V0 | 대기 |
| `lib/agent/event-status.ts` | V0 | 대기 |
| `lib/agent/extract-text.ts` | V0 | 대기 |
| `lib/agent/handlers/settlement-plan.ts` | V0 | 대기 |
| `lib/agent/handlers/settlement.ts` | V0 | 대기 |
| `lib/agent/image-magic.ts` | V0 | 대기 |
| `lib/agent/ingest-notification.ts` | V0 | 대기 |
| `lib/agent/ingest-pipeline.ts` | V0 | 대기 |
| `lib/agent/ingest-source.ts` | V0 | 대기 |
| `lib/agent/ingest.ts` | V0 | 대기 |
| `lib/agent/membership.ts` | V0 | 대기 |
| `lib/agent/notify.ts` | V0 | 대기 |
| `lib/agent/policy.ts` | V0 | 대기 |
| `lib/agent/receipt-vision.ts` | V0 | 대기 |
| `lib/agent/run.ts` | V0 | 대기 |
| `lib/agent/sms-text.ts` | V0 | 대기 |
| `lib/agent/tokens.ts` | V0 | 대기 |
| `lib/ai/budget-insight-record.ts` | B1 | 대기 |
| `lib/ai/budget-insight.ts` | B1 | 대기 |
| `lib/ai/budget-reality-check.ts` | B1 | 대기 |
| `lib/ai/chat-client.ts` | B1 | 대기 |
| `lib/ai/contracts.ts` | B1 | 대기 |
| `lib/ai/destination-knowledge.ts` | B1 | 대기 |
| `lib/ai/destination-pois.ts` | B1 | 대기 |
| `lib/ai/gemini.ts` | B1 | 대기 |
| `lib/ai/generate-itinerary.ts` | B1 | 대기 |
| `lib/ai/generate-plan.ts` | B1 | 대기 |
| `lib/ai/insight/index.ts` | B1 | 대기 |
| `lib/ai/insight/modes.ts` | B1 | 대기 |
| `lib/ai/insight/prompts.ts` | B1 | 대기 |
| `lib/ai/party-insight.ts` | B1 | 대기 |
| `lib/ai/plan-easter-egg.ts` | B1 | 대기 |
| `lib/ai/prompts/insight-prompts.ts` | B1 | 대기 |
| `lib/ai/prompts/shared.ts` | B1 | 대기 |
| `lib/ai/realloc-budget.ts` | B1 | 대기 |
| `lib/ai/receipt-schema.ts` | B1 | 대기 |
| `lib/ai/schedule-insight.ts` | B1 | 대기 |
| `lib/ai/stream-chat.ts` | B1 | 대기 |
| `lib/ai/trip-tips.ts` | B1 | 대기 |
| `lib/ai/types.ts` | B1 | 대기 |
| `lib/ai/usage.ts` | B1 | 대기 |
| `lib/ai/weather-insight.ts` | B1 | 대기 |
| `lib/airports/data.ts` | B1 | 대기 |
| `lib/api/fetch-json.ts` | B2 | 대기 |
| `lib/api/respond.ts` | B2 | 대기 |
| `lib/auth/AuthProvider.tsx` | O6 | 검증(V0, 2026-11-03, PR #72) |
| `lib/auth/callback-error.ts` | O6 | 검증(V0, 2026-11-03, PR #72) |
| `lib/auth/community-access.ts` | O6 | 검증(V0, 2026-11-03, PR #72) |
| `lib/auth/guest-cookie.ts` | O6 | 검증(V0, 2026-11-03, PR #72) |
| `lib/auth/guest-session.ts` | O6 | 검증(V0, 2026-11-03, PR #72) |
| `lib/auth/kakao.ts` | O6 | 검증(V0, 2026-11-03, PR #72) |
| `lib/auth/login-methods.ts` | O6 | 검증(V0, 2026-11-03, PR #72) |
| `lib/auth/post-login-path.ts` | O6 | 검증(V0, 2026-11-03, PR #72) |
| `lib/auth/route-access.ts` | O6 | 검증(V0, 2026-11-03, PR #72) |
| `lib/auth/types.ts` | O6 | 검증(V0, 2026-11-03, PR #72) |
| `lib/checklist/categories.ts` | B2 | 대기 |
| `lib/checklist/country-docs.ts` | B2 | 대기 |
| `lib/checklist/docs-ai.ts` | B2 | 대기 |
| `lib/checklist/docs-storage.ts` | B2 | 대기 |
| `lib/checklist/docs-upload.ts` | B2 | 대기 |
| `lib/checklist/legacy-cleanup.ts` | B2 | 대기 |
| `lib/checklist/resolve-docs-country.ts` | B2 | 대기 |
| `lib/checklist/types.ts` | B2 | 대기 |
| `lib/checklist/useChecklistItems.ts` | B2 | 대기 |
| `lib/community/CommunityProvider.tsx` | D6 | 대기 |
| `lib/community/author.ts` | D6 | 대기 |
| `lib/community/chat-attachments.ts` | D6 | 대기 |
| `lib/community/chat-notice.ts` | D6 | 대기 |
| `lib/community/chat-storage.ts` | D6 | 대기 |
| `lib/community/chat-supabase.ts` | D6 | 대기 |
| `lib/community/counts.ts` | D6 | 대기 |
| `lib/community/format.ts` | D6 | 대기 |
| `lib/community/notifications-supabase.ts` | D6 | 대기 |
| `lib/community/post-images.ts` | D6 | 대기 |
| `lib/community/storage.ts` | D6 | 대기 |
| `lib/community/supabase.ts` | D6 | 대기 |
| `lib/community/types.ts` | D6 | 대기 |
| `lib/community/useChatRoomSummaries.ts` | D6 | 대기 |
| `lib/community/useCommunityFeed.ts` | D6 | 대기 |
| `lib/community/useCommunityPartyActions.ts` | D6 | 대기 |
| `lib/constants/index.ts` | Q0 | 대기 |
| `lib/db/migration-columns.ts` | Q0 | 대기 |
| `lib/deals/data.ts` | B1 | 대기 |
| `lib/deals/recommend-deals.ts` | B1 | 대기 |
| `lib/demo/ingest-table.ts` | Q1 | 대기 |
| `lib/demo/mode.ts` | Q1 | 대기 |
| `lib/demo/scenario.ts` | Q1 | 대기 |
| `lib/design/tokens.ts` | D0 | 검증(V0, 2026-11-03, PR #72) |
| `lib/dm/dm-attachments.ts` | D6 | 대기 |
| `lib/dm/dm-supabase.ts` | D6 | 대기 |
| `lib/easter/kangwon-univ.ts` | B1 | 대기 |
| `lib/easter/pet-buddy.ts` | B1 | 대기 |
| `lib/env.ts` | Q0 | 대기 |
| `lib/errors/user-message.ts` | U10 | 대기 |
| `lib/flights/agoda-url.ts` | B1 | 대기 |
| `lib/flights/google-flights-url.ts` | B1 | 대기 |
| `lib/flights/naver-flights-url.ts` | B1 | 대기 |
| `lib/flights/plan-flight-quote.ts` | B1 | 대기 |
| `lib/format/relative-time.ts` | U10 | 대기 |
| `lib/friends/FriendsProvider.tsx` | D6 | 대기 |
| `lib/friends/supabase.ts` | D6 | 대기 |
| `lib/fx/currencies.ts` | F1 | 대기 |
| `lib/fx/currency-list.ts` | F1 | 대기 |
| `lib/fx/resolve-trip-currency.ts` | F1 | 대기 |
| `lib/fx/server.ts` | F1 | 대기 |
| `lib/fx/useFxTarget.ts` | F1 | 대기 |
| `lib/geo/region.ts` | Q0 | 대기 |
| `lib/hooks/useAutomationStatus.ts` | U10 | 대기 |
| `lib/hooks/useOnlineStatus.ts` | U10 | 대기 |
| `lib/hotels/affiliate.ts` | B1 | 대기 |
| `lib/hotels/agoda-cities.ts` | B1 | 대기 |
| `lib/hotels/agoda-url.ts` | B1 | 대기 |
| `lib/hotels/destinations.ts` | B1 | 대기 |
| `lib/hotels/plan-hotel-quote.ts` | B1 | 대기 |
| `lib/itinerary/apply-patch.ts` | U9 | 대기 |
| `lib/ledger/dcc.ts` | U1~U6 | 대기 |
| `lib/ledger/dedupe.ts` | U1~U6 | 대기 |
| `lib/ledger/draft.ts` | U1~U6 | 대기 |
| `lib/ledger/exif.ts` | U1~U6 | 대기 |
| `lib/ledger/explain.ts` | U1~U6 | 대기 |
| `lib/ledger/fee-leak.ts` | U1~U6 | 대기 |
| `lib/ledger/fx-display.ts` | U1~U6 | 대기 |
| `lib/ledger/fx-merge.ts` | U1~U6 | 대기 |
| `lib/ledger/fx-server.ts` | U1~U6 | 대기 |
| `lib/ledger/fx.ts` | U1~U6 | 대기 |
| `lib/ledger/image-limits.ts` | U1~U6 | 대기 |
| `lib/ledger/image.ts` | U1~U6 | 대기 |
| `lib/ledger/journey-state.ts` | U1~U6 | 검증(V0, 2026-11-03, PR #72) |
| `lib/ledger/jp-tax-refund.ts` | U1~U6 | 대기 |
| `lib/ledger/money.ts` | U1~U6 | 대기 |
| `lib/ledger/my-share.ts` | U1~U6 | 대기 |
| `lib/ledger/notif/apps.ts` | U1~U6 | 대기 |
| `lib/ledger/pay-links.ts` | U1~U6 | 대기 |
| `lib/ledger/proposals-client.ts` | U1~U6 | 대기 |
| `lib/ledger/proposals.ts` | U1~U6 | 대기 |
| `lib/ledger/recap.ts` | U1~U6 | 대기 |
| `lib/ledger/receipt-client.ts` | U1~U6 | 대기 |
| `lib/ledger/receipt-event.ts` | U1~U6 | 대기 |
| `lib/ledger/receipt-postprocess.ts` | U1~U6 | 대기 |
| `lib/ledger/settle-currency.ts` | U1~U6 | 대기 |
| `lib/ledger/settle-share.ts` | U1~U6 | 대기 |
| `lib/ledger/settle.ts` | U1~U6 | 대기 |
| `lib/ledger/share-inbox.ts` | U1~U6 | 대기 |
| `lib/ledger/shared-settlement.ts` | U1~U6 | 대기 |
| `lib/ledger/sms/__fixtures__/sms.ts` | U1~U6 | 대기 |
| `lib/ledger/sms/parse.ts` | U1~U6 | 대기 |
| `lib/ledger/spend-by-place.ts` | U1~U6 | 대기 |
| `lib/ledger/split-patch-server.ts` | U1~U6 | 대기 |
| `lib/ledger/split-patch.ts` | U1~U6 | 검증(V0, 2026-11-03, PR #72) |
| `lib/ledger/stats.ts` | U1~U6 | 대기 |
| `lib/ledger/supabase.ts` | U1~U6 | 대기 |
| `lib/ledger/trip-dates.ts` | U1~U6 | 대기 |
| `lib/ledger/types.ts` | U1~U6 | 대기 |
| `lib/ledger/useLedger.ts` | U1~U6 | 대기 |
| `lib/legal/documents.ts` | Q0 (D1) | 대기 |
| `lib/map/day-colors.ts` | Q0 (D4) | 대기 |
| `lib/map/provider.ts` | Q0 (D4) | 대기 |
| `lib/map/trip-points.ts` | Q0 (D4) | 대기 |
| `lib/mock/community.ts` | B1 | 대기 |
| `lib/mock/home.ts` | B1 | 대기 |
| `lib/mock/loaders.ts` | B1 | 대기 |
| `lib/mock/profile.ts` | B1 | 대기 |
| `lib/navigation/useGoBack.ts` | Q0 (U7) | 대기 |
| `lib/onboarding/agent-context.ts` | U8 | 대기 |
| `lib/onboarding/automation-ui-state.ts` | U8 | 대기 |
| `lib/onboarding/automation.ts` | U8 | 대기 |
| `lib/onboarding/connect-entry.ts` | U8 | 대기 |
| `lib/onboarding/connect-machine.ts` | U8 | 대기 |
| `lib/onboarding/connect-storage.ts` | U8 | 대기 |
| `lib/onboarding/constants.ts` | U8 | 대기 |
| `lib/onboarding/dev-snippets.ts` | U8 | 대기 |
| `lib/onboarding/first-run.ts` | U8 | 대기 |
| `lib/onboarding/gate-label.ts` | U8 | 대기 |
| `lib/onboarding/guide-content.ts` | U8 | 대기 |
| `lib/onboarding/last-device-event.ts` | U8 | 대기 |
| `lib/onboarding/qr-svg.ts` | U8 | 대기 |
| `lib/onboarding/token-label.ts` | U8 | 대기 |
| `lib/onboarding/trip-match.ts` | U8 | 대기 |
| `lib/onboarding/trip-window.ts` | U8 | 대기 |
| `lib/onboarding/types.ts` | U8 | 대기 |
| `lib/places/autocomplete.ts` | B2 | 대기 |
| `lib/places/cache.ts` | B2 | 대기 |
| `lib/places/candidate-schedule.ts` | B2 | 대기 |
| `lib/places/candidates.ts` | B2 | 대기 |
| `lib/places/fixtures/fuku.json` | B2 | 대기 |
| `lib/places/fixtures/icn.json` | B2 | 대기 |
| `lib/places/fixtures/japan.json` | B2 | 대기 |
| `lib/places/google-map.ts` | B2 | 대기 |
| `lib/places/google.ts` | B2 | 대기 |
| `lib/places/index.ts` | B2 | 대기 |
| `lib/places/kakao-map.ts` | B2 | 대기 |
| `lib/places/kakao.ts` | B2 | 대기 |
| `lib/places/registry.ts` | B2 | 대기 |
| `lib/places/types.ts` | B2 | 대기 |
| `lib/places/usePlaceAutocomplete.ts` | B2 | 대기 |
| `lib/profile/ProfileProvider.tsx` | D7 | 대기 |
| `lib/profile/enrich-author-avatars.ts` | D7 | 대기 |
| `lib/profile/public.ts` | D7 | 대기 |
| `lib/profile/storage.ts` | D7 | 대기 |
| `lib/profile/supabase.ts` | D7 | 대기 |
| `lib/push/client.ts` | B1 | 대기 |
| `lib/push/notify-copy.ts` | B1 | 대기 |
| `lib/push/send.ts` | B1 | 대기 |
| `lib/rag/budgetBands.ts` | B1 | 대기 |
| `lib/rag/monthDeals.ts` | B1 | 대기 |
| `lib/rag/travelKnowledge.ts` | B1 | 대기 |
| `lib/route/distance.ts` | B2 | 대기 |
| `lib/route/genetic.ts` | B2 | 대기 |
| `lib/route/geocode.ts` | B2 | 대기 |
| `lib/route/matrix/cache.ts` | B2 | 대기 |
| `lib/route/matrix/google.ts` | B2 | 대기 |
| `lib/route/matrix/haversine.ts` | B2 | 대기 |
| `lib/route/matrix/index.ts` | B2 | 대기 |
| `lib/route/matrix/kakao.ts` | B2 | 대기 |
| `lib/route/matrix/osrm.ts` | B2 | 대기 |
| `lib/route/matrix/types.ts` | B2 | 대기 |
| `lib/route/optimize-schedule.ts` | B2 | 대기 |
| `lib/route/recompute-day.ts` | B2 | 대기 |
| `lib/route/schedule-solver.ts` | B2 | 대기 |
| `lib/route/travel-matrix.ts` | B2 | 대기 |
| `lib/route/types.ts` | B2 | 대기 |
| `lib/security/guard.ts` | O6 | 검증(V0, 2026-11-03, PR #72) |
| `lib/security/guest-secret.ts` | O6 | 대기 |
| `lib/security/identity.ts` | O6 | 대기 |
| `lib/security/public-api.ts` | O6 | 대기 |
| `lib/security/rate-limit.ts` | O6 | 대기 |
| `lib/security/safe-next.ts` | O6 | 대기 |
| `lib/server/cache.ts` | B1 | 대기 |
| `lib/server/upstream.ts` | B1 | 대기 |
| `lib/shared/dates.ts` | U10 | 대기 |
| `lib/shared/format.ts` | U10 | 대기 |
| `lib/site-url.ts` | Q0 | 대기 |
| `lib/supabase/admin.ts` | O6 | 대기 |
| `lib/supabase/browser.ts` | O6 | 대기 |
| `lib/supabase/env.ts` | O6 | 대기 |
| `lib/supabase/server.ts` | O6 | 대기 |
| `lib/tips/buildTipsForTrip.ts` | U9 | 대기 |
| `lib/travel/links-enabled.ts` | Q0 | 대기 |
| `lib/trips/TripProvider.tsx` | U9 | 대기 |
| `lib/trips/country-memory.ts` | U9 | 대기 |
| `lib/trips/d-day.ts` | U9 | 대기 |
| `lib/trips/data.ts` | U9 | 대기 |
| `lib/trips/destination-image.ts` | U9 | 대기 |
| `lib/trips/quick-trip.ts` | U9 | 대기 |
| `lib/trips/share.ts` | U9 | 대기 |
| `lib/trips/storage.ts` | U9 | 대기 |
| `lib/trips/supabase.ts` | U9 | 대기 |
| `lib/trips/types.ts` | U9 | 대기 |
| `lib/trips/visited-countries.ts` | U9 | 대기 |
| `lib/weather/open-meteo.ts` | U9 | 대기 |
| `lib/weather/parse-trip-dates.ts` | U9 | 대기 |

### 스크립트 (`scripts/**`) — 12개

| 경로 | 담당 세션 | 상태 |
|---|---|---|
| `scripts/apply-supabase-migrations.mjs` | V0 · B2 | 대기 |
| `scripts/bootstrap-new-supabase.mjs` | B2 (README, 삭제 안 함) | 대기 |
| `scripts/clean-next.cjs` | Q0 | 대기 |
| `scripts/demo-ingest.mjs` | Q1 | 대기 |
| `scripts/eval-receipts.ts` | F1 | 대기 |
| `scripts/gemini-smoke.ts` | B2 (README, 삭제 안 함) | 대기 |
| `scripts/gen-vapid.mjs` | B2 (README, 삭제 안 함) | 대기 |
| `scripts/make-favicon.py` | B2 (README, 삭제 안 함) | 대기 |
| `scripts/preview-smoke.mjs` | Q1 | 대기 |
| `scripts/preview-smoke.test.mjs` | Q1 | 대기 |
| `scripts/sync-vercel-supabase-env.mjs` | B2 (README, 삭제 안 함) | 대기 |
| `scripts/verify-supabase.mjs` | V0 · B2 | 대기 |

### DB (`supabase/**`) — 기존 마이그레이션 수정 금지 — 43개

| 경로 | 담당 세션 | 상태 |
|---|---|---|
| `supabase/config.toml` | V0 · B3 | 대기 |
| `supabase/migrations/20260709100400_create_profiles_and_avatars.sql` | V0 · B3 (수정 금지) | 대기 |
| `supabase/migrations/20260709150000_core_app_tables.sql` | V0 · B3 (수정 금지) | 대기 |
| `supabase/migrations/20260709150100_party_members.sql` | V0 · B3 (수정 금지) | 대기 |
| `supabase/migrations/20260709162000_party_chat_messages.sql` | V0 · B3 (수정 금지) | 대기 |
| `supabase/migrations/20260710120000_party_chat_realtime.sql` | V0 · B3 (수정 금지) | 대기 |
| `supabase/migrations/20260710150000_party_chat_attachments.sql` | V0 · B3 (수정 금지) | 대기 |
| `supabase/migrations/20260710160000_trip_share_token.sql` | V0 · B3 (수정 금지) | 대기 |
| `supabase/migrations/20260710170000_community_post_images.sql` | V0 · B3 (수정 금지) | 대기 |
| `supabase/migrations/20260710180000_checklist_docs_storage.sql` | V0 · B3 (수정 금지) | 대기 |
| `supabase/migrations/20260710220000_party_join_approval.sql` | V0 · B3 (수정 금지) | 대기 |
| `supabase/migrations/20260710221000_notifications_realtime.sql` | V0 · B3 (수정 금지) | 대기 |
| `supabase/migrations/20260711120000_comment_likes.sql` | V0 · B3 (수정 금지) | 대기 |
| `supabase/migrations/20260711140000_profiles_public_read.sql` | V0 · B3 (수정 금지) | 대기 |
| `supabase/migrations/20260711150000_community_chat_category.sql` | V0 · B3 (수정 금지) | 대기 |
| `supabase/migrations/20260711160000_friendships.sql` | V0 · B3 (수정 금지) | 대기 |
| `supabase/migrations/20260711170000_friend_requests.sql` | V0 · B3 (수정 금지) | 대기 |
| `supabase/migrations/20260711200000_normalize_user_fks.sql` | V0 · B3 (수정 금지) | 대기 |
| `supabase/migrations/20260711210000_drop_unused_tables.sql` | V0 · B3 (수정 금지) | 대기 |
| `supabase/migrations/20260713093000_dm_threads_messages.sql` | V0 · B3 (수정 금지) | 대기 |
| `supabase/migrations/20260713095000_dm_attachments_notifications.sql` | V0 · B3 (수정 금지) | 대기 |
| `supabase/migrations/20261029120000_places_cache.sql` | V0 · B3 (수정 금지) | 대기 |
| `supabase/migrations/20261029130000_trip_ledger.sql` | V0 · B3 (수정 금지) | 대기 |
| `supabase/migrations/20261029140000_trip_ledger_core.sql` | V0 · B3 (수정 금지) | 대기 |
| `supabase/migrations/20261029141000_save_trip_expense.sql` | V0 · B3 (수정 금지) | 대기 |
| `supabase/migrations/20261030120000_agent_core.sql` | V0 · B3 (수정 금지) | 대기 |
| `supabase/migrations/20261030130000_agent_core_fixes.sql` | V0 · B3 (수정 금지) | 대기 |
| `supabase/migrations/20261030140000_api_cache.sql` | V0 · B3 (수정 금지) | 대기 |
| `supabase/migrations/20261030150000_agent_user_state.sql` | V0 · B3 (수정 금지) | 대기 |
| `supabase/migrations/20261030160000_agent_trip_optional.sql` | V0 · B3 (수정 금지) | 대기 |
| `supabase/migrations/20261030170000_agent_unassigned.sql` | V0 · B3 (수정 금지) | 대기 |
| `supabase/migrations/20261031120000_agent_events_indexes.sql` | V0 · B3 (수정 금지) | 대기 |
| `supabase/migrations/20261031140000_rls_initplan_hot.sql` | V0 · B3 (수정 금지) | 대기 |
| `supabase/migrations/20261101120000_agent_attach_receipt.sql` | V0 · B3 (수정 금지) | 대기 |
| `supabase/migrations/20261101130000_trip_dates_backfill.sql` | V0 · B3 (수정 금지) | 대기 |
| `supabase/migrations/20261101140000_trip_member_read.sql` | V0 · B3 (수정 금지) | 대기 |
| `supabase/migrations/20261103100000_fx_billed_merge.sql` | V0 · B3 (수정 금지) | 대기 |
| `supabase/migrations/20261103110000_notif_expense_dcc.sql` | V0 · B3 (수정 금지) | 대기 |
| `supabase/migrations/20261103120000_split_patch_history.sql` | V0 · B3 (수정 금지) | 대기 |
| `supabase/migrations/20261103140000_guest_permissions.sql` | V0 · B3 (수정 금지) | 검증(V0, 2026-11-03, PR #72) |
| `supabase/migrations/20261103200000_shared_settlement_billed.sql` | V0 · B3 (수정 금지) | 대기 |
| `supabase/migrations/20261103210000_tax_free.sql` | V0 · B3 (수정 금지) | 대기 |
| `supabase/verify/guest_permissions_verify.sql` | V0 · B3 | 검증(V0, 2026-11-03, PR #72) |

### 정적 파일 (`public/**`) — 16개

| 경로 | 담당 세션 | 상태 |
|---|---|---|
| `public/android-chrome-192x192.png` | D1 · O6 | 대기 |
| `public/android-chrome-512x512.png` | D1 · O6 | 대기 |
| `public/apple-touch-icon.png` | D1 · O6 | 대기 |
| `public/easter/ball.gif` | D1 · O6 | 대기 |
| `public/easter/cat.gif` | D1 · O6 | 대기 |
| `public/easter/cat.png` | D1 · O6 | 대기 |
| `public/easter/dog-track.png` | D1 · O6 | 대기 |
| `public/easter/dog.gif` | D1 · O6 | 대기 |
| `public/easter/dog.png` | D1 · O6 | 대기 |
| `public/favicon-16x16.png` | D1 · O6 | 대기 |
| `public/favicon-32x32.png` | D1 · O6 | 대기 |
| `public/favicon.png` | D1 · O6 | 대기 |
| `public/icon.png` | D1 · O6 | 대기 |
| `public/offline.html` | O6 · D1 | 대기 |
| `public/site.webmanifest` | O6 · D1 | 대기 |
| `public/sw.js` | O6 · D1 | 대기 |

### 설정 파일 — 17개

| 경로 | 담당 세션 | 상태 |
|---|---|---|
| `.claude/settings.json` | C0 | 완료(C0, 2026-11-03, PR #71) |
| `.env.example` | B2 | 대기 |
| `.github/workflows/ci.yml` | B2 · Q1 | 대기 |
| `.gitignore` | C0 | 완료(C0, 2026-11-03, PR #71) |
| `CLAUDE.md` | C0 | 완료(C0, 2026-11-03, PR #71) |
| `README.md` | B2 | 대기 |
| `eslint.config.mjs` | Q0 | 대기 |
| `middleware.ts` | O6 | 대기 |
| `next.config.mjs` | O5 · O6 | 대기 |
| `package-lock.json` | Q0 (변경 커밋 금지) | 대기 |
| `package.json` | Q0 | 대기 |
| `postcss.config.mjs` | Q0 | 대기 |
| `tailwind.config.ts` | D8 | 검증(V0, 2026-11-03, PR #72) |
| `tsconfig.json` | Q0 | 대기 |
| `vercel.json` | B2 · Q1 | 대기 |
| `vitest-server-only-stub.ts` | Q0 | 대기 |
| `vitest.config.ts` | Q0 | 대기 |

### 문서 (`docs/**`) — 8개

| 경로 | 담당 세션 | 상태 |
|---|---|---|
| `docs/agent-cron.md` | Q1 | 대기 |
| `docs/demo-assets.md` | Q1 | 대기 |
| `docs/demo-checklist.md` | Q1 | 대기 |
| `docs/design-system.md` | D0 · D8 | 대기 |
| `docs/ios-shortcut-build.md` | Q1 | 대기 |
| `docs/migrations-audit.md` | B2 | 대기 |
| `docs/pitch-notes.md` | Q1 | 대기 |
| `docs/refactor-map.md` | C0 (모든 세션 갱신) | 완료(C0, 2026-11-03, PR #71) |

### 기타 (`types/` · `eval/` · `tests/` · `.cursor/`) — 5개

| 경로 | 담당 세션 | 상태 |
|---|---|---|
| `.cursor/rules/hackathon.mdc` | Q0 | 대기 |
| `eval/receipts/README.md` | F1 | 대기 |
| `eval/receipts/labels.example.json` | F1 | 대기 |
| `tests/middleware.test.ts` | Q0 | 대기 |
| `types/kakao-maps.d.ts` | Q0 | 대기 |

## 진행 로그

형식: 날짜(KST) · 세션 · 브랜치 · 한 일 요약 · 명령 결과 · 남은 일/확인 필요 · 다음 세션 인계

### 2026-11-03 (KST) · C0 · `chore/claude-code-setup`

**한 일**
- 레포 루트 `CLAUDE.md` — 런북 §2 블록 원문 그대로 저장.
- `.claude/settings.json` — 런북 §2-1 원문(정확 일치 규칙만). `.gitignore` 에 `.claude/settings.local.json` 한 줄 추가.
- 이 파일(`docs/refactor-map.md`) — 세션 상태 34행, 커버리지 표(`git ls-files` 비테스트 679행, 미분류 0), 진행 로그.
- 코드 변경 없음.

**명령 결과**
- `npm install`: up to date, `package-lock.json` 변경 없음. (`npm audit` 19건 보고됨 — 16 moderate·1 high·2 critical. 수정하지 않음, V0 보고서에 기록할 것)
- `.claude/settings.json` JSON 파싱 OK
- `npm run typecheck` 통과 · `npm run lint` 통과(경고 0) · `npm test` 통과 — 183 파일 / 1315 tests
- `npm run build`: UI·라우트 변경이 없어서 실행하지 않음(V0 가 기준선으로 실행)

**CLAUDE.md 경로·명령 검증** — 전부 존재, 고친 것 없음
- package.json scripts: `dev` `build`(= `node scripts/clean-next.cjs && next build`) `lint`(`--max-warnings 0`) `typecheck` `test` ✓
- `docs/design-system.md` · `lib/design/tokens.ts` · `app/globals.css`(`.mu-num` 있음) · `tailwind.config.ts` ✓
- `components/ds/*` — 컴포넌트 파일 11개 + `index.ts`, export 는 Stepper·StepHeader 포함 12개 ✓
- `lib/ledger/journey-state.ts` · `components/ledger/journey/TripJourney.tsx`(+`guest/`) · `components/ledger/LedgerShell.tsx` ✓
- `lib/api/route-inventory.test.ts` · `lib/ai/gemini.ts` · `lib/ledger/money.ts` · `lib/ledger/settle.ts`(`computeShares`) · `lib/ledger/split-patch.ts`(`applySplitPatch`·`chipToPatch`·`guestMayApply`) · `lib/ledger/sms/parse.ts`(`redactSms`) · `lib/agent/admin.ts` · `scripts/clean-next.cjs` · `.cursor/rules/hackathon.mdc` ✓
- 개수: 페이지 34 · `app/api` 라우트 61 · 마이그레이션 41 ✓ (런북과 일치)
- 의존성 버전: next ^15.1.6 · zod ^4.6.7 · vitest ^3.2.7 · tailwind ^3.4.17 ✓, shadcn/radix/framer-motion 없음 ✓

**코드·문서 차이 (보고만)**
1. 런북 기준은 `c26ea15f`(#69)인데 현재 main 은 `acbe196`(#70 머지). #70 이 바꾼 것: `/agent` 가 저장된 선택·여행 1개면 바로 홈으로(런북 P0 해결), `TripHeaderCard` 버튼이 「목록으로」, `StepCode` 의 `DevCurlFold` 는 dev/데모 모드에서만, `RecommendedGrid` 빈 응답 시 SSR 유지, 홈 「AI 팁」·「진행·예정 여행」, 알림 벨 44px, 게스트 `/trips` 로그인 카드.
2. CI build env 에는 `INTERNAL_API_SECRET` 도 있어요. CLAUDE.md 의 더미 env 목록엔 없고 런북 수용 기준엔 있어요 → B2(`INTERNAL_API_SECRET` 더미 제거) 대상.
3. `app/auth/{callback,logout}/route.ts` 는 런북 §6 에 없어요(`app/api` 밖 인증 라우트). 표에서 O6 · Q1 로 배정.
4. #66~#70 에서 추가된 UI(`LedgerTripPicker`·`about`·가계부 홈 등)는 레거시 팔레트(`brand/surface/ink/mint`)를 아직 써요 → D2·D7·D8 에서 정리.
5. 이 세션은 Cursor 에이전트로 실행했어요. `@.cursor/rules/hackathon.mdc` 임포트가 Claude Code 에서 로드되는지는 **확인 필요**(Evan: Claude Code `/memory`).

**남은 일 / 확인 필요**
- Evan: GitHub `main` 브랜치 보호(직접 push·force-push 금지, PR·CI 필수) — 런북 §7-2.
- 머지 방식: 이번 실행은 Evan 결정에 따라 **에이전트가 CI 통과 후 머지**해요(런북 기본값 "사람이 머지"와 다름).

**다음 세션(V0) 인계**
- 기준선 측정은 `acbe196` 이후 main 기준으로 해요(#70 반영). build 는 더미 env 5개(`INTERNAL_API_SECRET` 포함, CI 와 동일)로.
- `npm audit` 19건을 보고서에 기록.
- 커버리지 표 재생성이 필요하면 담당 배정 규칙은 런북 §6 + 위 3번.

### 2026-11-03 (KST) · V0 · `chore/baseline-audit` · PR #72

**한 일**
- `docs/audit/baseline-2026-11.md` 추가(보고서만, 코드 변경 없음): 명령 5개 결과, 빌드 라우트 100개 First Load JS 표, S0·디자인 토대·여정·게스트 합류 검증, step × LedgerShell 표, 심각도별 문제, 문서와 다른 점, Evan 체크리스트.

**명령 결과**
- `npm install` up to date(락파일 변경 없음) · `typecheck` 통과 · `lint` 통과(경고 0) · `npm test` 183 파일 / 1315 tests 통과 · `npm run build` 통과(더미 env 5개, 정적 63/63)
- 빌드 기준선: 공유 First Load JS 103 kB · Middleware 95.8 kB · 가장 큰 페이지 `/agent` 273 kB · `/trips/[id]` 270 kB · `/agent/inbox`·`/trips/[id]/ledger/inbox` 267 kB · `/` 266 kB
- `npm audit` 19건(critical 2·high 1·moderate 16), 런타임 의존성은 `next`(moderate)만

**차단 3건 (고치지 않음)**
- X1 익명 게스트의 이름 claim 합류가 S0 트리거로 실패 — DB, 재현 필요
- X2 게스트 `adjust`/`pay` 단계가 호스트 키와 겹쳐 기본 단계로 replace
- X3 게스트가 「내가 냈어요」·내 몫 조정에 도달 불가

**결정 (런북 V0 체크포인트)**
- 차단 X1~X3 와 중요 I1(되돌리기 라우트 익명 허용)을 **B1 앞에 수정 세션 2개로 끼워요**:
  - V0a `fix/guest-journey-blockers` — X2·X3·I1 (앱 코드)
  - V0b `fix/guest-claim-trigger` — X1 (새 마이그레이션 파일만, **DB 적용은 Evan**)

**남은 일 / 확인 필요**
- Evan: 검증 SQL 블록 A→B~C, X1·I2·I3 재현, 익명 로그인 설정, trip-tips 위험 판단(보고서 §6)
- 새 파일 `docs/audit/baseline-2026-11.md` 는 커버리지 표에 행이 없어요(Q0 가 표를 다시 뽑을 때 포함)

**다음 세션 인계 (V0a → B1)**
- 디자인 위반 수(기본 팔레트 182 · 레거시 2,679 · ai-gradient/glow 30 · `[#hex]` 7 · 10px 이하 39)는 D0 래칫 기준이에요.
- ds 중 Button·ExpenseRow·MemberChip·Skeleton·StepHeader·useToast 는 앱 사용처 0 → B1 은 **지우지 말 것**(런북 B-2).
- `TripSwitcherSheet` 는 여전히 테스트에서만 사용(U7 결정).
