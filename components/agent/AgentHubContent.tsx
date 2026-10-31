"use client";

import { MoreHorizontal } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { DemoModePanel } from "@/components/agent/DemoModePanel";
import { LedgerHomeEmpty } from "@/components/agent/ledger-home/LedgerHomeEmpty";
import { LedgerHomeGuest } from "@/components/agent/ledger-home/LedgerHomeGuest";
import { LedgerHomeSkeleton } from "@/components/agent/ledger-home/LedgerHomeSkeleton";
import { MoreSheet } from "@/components/agent/ledger-home/MoreSheet";
import { NeedsReviewCard } from "@/components/agent/ledger-home/NeedsReviewCard";
import { pickFeaturedReview } from "@/components/agent/ledger-home/needsReview";
import { PrimaryActions } from "@/components/agent/ledger-home/PrimaryActions";
import { RecentExpenses } from "@/components/agent/ledger-home/RecentExpenses";
import { SettlementSummaryCard } from "@/components/agent/ledger-home/SettlementSummaryCard";
import { TripHeaderCard } from "@/components/agent/ledger-home/TripHeaderCard";
import { TripSwitcherSheet } from "@/components/agent/ledger-home/TripSwitcherSheet";
import { useLedgerHomeData } from "@/components/agent/ledger-home/useLedgerHomeData";
import { useSelectedTrip } from "@/components/agent/ledger-home/useSelectedTrip";
import { MobileShell } from "@/components/layout/MobileShell";
import { QuickTripSheet } from "@/components/trips/QuickTripSheet";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useAutomationStatus } from "@/lib/hooks/useAutomationStatus";
import { useTrips } from "@/lib/trips/TripProvider";

/**
 * 가계부 탭(/agent). 데이터·상태 훅만 두고 화면은 ledger-home/ 컴포넌트를 조립해요.
 * 동작·API·DB·돈 계산은 그대로이고 화면 구성만 바뀌었어요.
 */
export function AgentHubContent() {
  const { isReady: authReady, isLoggedIn, provider } = useAuth();
  const isGuest = provider === "guest" || (authReady && !isLoggedIn);
  const { trips, isReady, activeTrips } = useTrips();
  const { selectedTrip, select, ready } = useSelectedTrip(trips, isReady);
  const tripId = selectedTrip?.id ?? null;

  // 자동 기록 상태·확인 필요 알림: 비-lite 한 번으로 알약·미배정·최근 알림을 함께 읽어요.
  const automation = useAutomationStatus({
    enabled: authReady && isLoggedIn && !isGuest,
  });
  const home = useLedgerHomeData(tripId);

  const [quickOpen, setQuickOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const switchButtonRef = useRef<HTMLButtonElement>(null);

  const uiState = automation.uiState;
  const pill =
    !isGuest && !automation.loading && !automation.error && uiState
      ? uiState
      : null;
  const automationOff = pill === "off" || pill === "unverified";

  const unassignedCount = automation.data?.unassignedCount ?? 0;
  const reviewCount =
    (home.pending.status === "ready" ? (home.pending.data ?? 0) : 0) +
    unassignedCount;
  const featured = useMemo(
    () =>
      tripId
        ? pickFeaturedReview({
            events: automation.data?.recentEvents ?? [],
            tripId,
            activeTrips,
          })
        : null,
    [automation.data?.recentEvents, tripId, activeTrips]
  );

  const moreButton = isGuest ? null : (
    <button
      ref={moreButtonRef}
      type="button"
      aria-label="더보기"
      aria-haspopup="dialog"
      onClick={() => setMoreOpen(true)}
      className="inline-flex h-11 w-11 items-center justify-center rounded-full text-ink-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <MoreHorizontal className="h-5 w-5" aria-hidden />
    </button>
  );

  let body: React.ReactNode;
  if (!authReady) {
    body = <LedgerHomeSkeleton />;
  } else if (isGuest) {
    body = <LedgerHomeGuest />;
  } else if (!ready) {
    body = <LedgerHomeSkeleton />;
  } else if (!selectedTrip) {
    body = (
      <LedgerHomeEmpty
        onCreate={() => setQuickOpen(true)}
        showConnectHint={automationOff}
      />
    );
  } else {
    body = (
      <>
        <TripHeaderCard
          trip={selectedTrip}
          expenses={home.expenses}
          onRetryExpenses={home.retryExpenses}
          pill={pill}
          canSwitch={trips.length > 1}
          onSwitch={() => setSwitchOpen(true)}
          switchRef={switchButtonRef}
        />
        <PrimaryActions tripId={selectedTrip.id} />
        <NeedsReviewCard
          key={featured?.event.id ?? "none"}
          count={reviewCount}
          featured={featured}
          tripId={selectedTrip.id}
          onAssigned={() => {
            void automation.refresh();
            home.reloadPending();
            home.retryExpenses();
          }}
        />
        <RecentExpenses
          tripId={selectedTrip.id}
          expenses={home.expenses}
          members={home.members}
          onRetry={home.retryExpenses}
          automationOff={automationOff}
        />
        <SettlementSummaryCard
          tripId={selectedTrip.id}
          settlement={home.settlement}
          expenseCount={home.expenses.data?.length ?? 0}
          memberCount={home.members.data?.length ?? 0}
          onRetry={home.retrySettlement}
        />
      </>
    );
  }

  return (
    <MobileShell title="가계부" rightSlot={moreButton}>
      <div className="flex flex-col gap-4 px-4 py-4">
        {body}
        {/* 데모 모드가 켜졌을 때만 맨 아래에 접힌 채 보여요. 꺼져 있으면 아무것도 그리지 않아요. */}
        {!isGuest ? <DemoModePanel /> : null}
      </div>

      <MoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        tripId={tripId}
        unassignedCount={unassignedCount}
        returnFocusRef={moreButtonRef}
      />
      <TripSwitcherSheet
        open={switchOpen}
        onClose={() => setSwitchOpen(false)}
        trips={trips}
        selectedId={tripId}
        onSelect={select}
        onCreate={() => setQuickOpen(true)}
        returnFocusRef={switchButtonRef}
      />
      <QuickTripSheet
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
        onCreated={(trip) => select(trip.id)}
        reason="hub"
      />
    </MobileShell>
  );
}
