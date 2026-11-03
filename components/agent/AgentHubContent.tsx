"use client";

import { MoreHorizontal } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DemoModePanel } from "@/components/agent/DemoModePanel";
import { LedgerHomeEmpty } from "@/components/agent/ledger-home/LedgerHomeEmpty";
import { LedgerHomeGuest } from "@/components/agent/ledger-home/LedgerHomeGuest";
import { LedgerHomeSkeleton } from "@/components/agent/ledger-home/LedgerHomeSkeleton";
import { LedgerTripPicker } from "@/components/agent/ledger-home/LedgerTripPicker";
import { MoreSheet } from "@/components/agent/ledger-home/MoreSheet";
import { NeedsReviewCard } from "@/components/agent/ledger-home/NeedsReviewCard";
import { pickFeaturedReview } from "@/components/agent/ledger-home/needsReview";
import { PrimaryActions } from "@/components/agent/ledger-home/PrimaryActions";
import { RecentExpenses } from "@/components/agent/ledger-home/RecentExpenses";
import { SettlementSummaryCard } from "@/components/agent/ledger-home/SettlementSummaryCard";
import { TripHeaderCard } from "@/components/agent/ledger-home/TripHeaderCard";
import { useLedgerHomeData } from "@/components/agent/ledger-home/useLedgerHomeData";
import { useSelectedTrip } from "@/components/agent/ledger-home/useSelectedTrip";
import { ResumeCard } from "@/components/ledger/journey/ResumeCard";
import { MobileShell } from "@/components/layout/MobileShell";
import { QuickTripSheet } from "@/components/trips/QuickTripSheet";
import { useAuth } from "@/lib/auth/AuthProvider";
import { STORAGE_KEYS } from "@/lib/constants";
import { useAutomationStatus } from "@/lib/hooks/useAutomationStatus";
import { useTrips } from "@/lib/trips/TripProvider";

/**
 * 가계부 탭(/agent).
 * 최근 선택·여행 1개면 바로 홈, 아니면 카드로 골라 들어가요.
 */
export function AgentHubContent() {
  const { isReady: authReady, isLoggedIn, provider, isAnonymous } = useAuth();
  const isGuest = provider === "guest" || (authReady && !isLoggedIn);
  const canCreateTrip = !isGuest && !isAnonymous;
  const { trips, isReady, activeTrips } = useTrips();
  const { selectedTrip, select, ready } = useSelectedTrip(trips, isReady);
  /** pick = 여행 고르기, home = 선택한 여행 가계부 */
  const [phase, setPhase] = useState<"pick" | "home">("pick");
  const [phaseBooted, setPhaseBooted] = useState(false);
  /** 가계부 홈 데이터는 들어간 뒤에만 불러요 */
  const tripId =
    phase === "home" && selectedTrip ? selectedTrip.id : null;
  /** 더보기 메뉴는 목록에서도 기본/최근 여행 기준으로 열어요 */
  const moreTripId = selectedTrip?.id ?? null;

  useEffect(() => {
    if (!ready || phaseBooted || isGuest) return;
    setPhaseBooted(true);
    if (trips.length === 0) return;
    if (trips.length === 1) {
      setPhase("home");
      return;
    }
    try {
      const stored = window.localStorage.getItem(
        STORAGE_KEYS.ledgerSelectedTrip
      );
      if (stored && trips.some((t) => t.id === stored)) {
        setPhase("home");
      }
    } catch {
      // 목록부터 보여 줘요
    }
  }, [ready, phaseBooted, isGuest, trips]);

  const automation = useAutomationStatus({
    enabled: authReady && isLoggedIn && !isGuest,
  });
  const home = useLedgerHomeData(tripId);

  const [quickOpen, setQuickOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const listButtonRef = useRef<HTMLButtonElement>(null);

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

  function enterTrip(id: string) {
    select(id);
    setPhase("home");
  }

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
  } else if (trips.length === 0) {
    body = canCreateTrip ? (
      <LedgerHomeEmpty
        onCreate={() => setQuickOpen(true)}
        showConnectHint={automationOff}
      />
    ) : (
      <p className="rounded-xl bg-surface-soft px-3 py-4 text-center text-sm text-ink-muted">
        합류한 여행이 없어요. 초대 링크로 들어와 주세요.
      </p>
    );
  } else if (phase === "pick" || !selectedTrip) {
    body = (
      <LedgerTripPicker
        trips={trips}
        onSelect={enterTrip}
        onCreate={canCreateTrip ? () => setQuickOpen(true) : undefined}
        continueTrip={selectedTrip}
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
          canSwitch
          onSwitch={() => setPhase("pick")}
          switchRef={listButtonRef}
        />
        <ResumeCard
          tripId={selectedTrip.id}
          role="host"
          automationUi={pill}
          memberCount={
            home.members.status === "ready"
              ? (home.members.data?.length ?? 0)
              : null
          }
          expenseCount={
            home.expenses.status === "ready"
              ? (home.expenses.data?.length ?? 0)
              : null
          }
          pendingReviewCount={
            home.pending.status === "ready" ? (home.pending.data ?? 0) : null
          }
          pendingProposalCount={0}
          settlement={
            home.settlement.status === "ready"
              ? home.settlement.data
              : undefined
          }
          loading={
            home.members.status === "loading" ||
            home.expenses.status === "loading" ||
            home.pending.status === "loading" ||
            home.settlement.status === "loading"
          }
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
        {!isGuest && phase === "home" ? <DemoModePanel /> : null}
      </div>

      <MoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        tripId={moreTripId}
        unassignedCount={unassignedCount}
        returnFocusRef={moreButtonRef}
      />
      {canCreateTrip ? (
        <QuickTripSheet
          open={quickOpen}
          onClose={() => setQuickOpen(false)}
          onCreated={(trip) => enterTrip(trip.id)}
          reason="hub"
        />
      ) : null}
    </MobileShell>
  );
}
