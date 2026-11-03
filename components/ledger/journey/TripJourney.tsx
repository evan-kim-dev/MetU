"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BottomCTA } from "@/components/ds/BottomCTA";
import { Stepper } from "@/components/ds/Stepper";
import { ToastProvider } from "@/components/ds/Toast";
import { GuestAdjust } from "@/components/ledger/journey/guest/GuestAdjust";
import { GuestDone } from "@/components/ledger/journey/guest/GuestDone";
import { GuestPay } from "@/components/ledger/journey/guest/GuestPay";
import { GuestShare } from "@/components/ledger/journey/guest/GuestShare";
import { LedgerShell } from "@/components/ledger/LedgerShell";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useAutomationStatus } from "@/lib/hooks/useAutomationStatus";
import {
  deriveJourney,
  isGuestStepKey,
  isHostStepKey,
  resolveStepParam,
  type GuestStepKey,
  type HostStepKey,
  type JourneyRole,
  type JourneySettlement,
  type JourneyStepKey,
} from "@/lib/ledger/journey-state";
import { computeBalances } from "@/lib/ledger/settle";
import {
  fetchLatestSettlement,
  listExpenses,
  listMembers,
} from "@/lib/ledger/supabase";
import type { LedgerExpenseRow, TripMember } from "@/lib/ledger/types";
import { getBrowserSupabase } from "@/lib/supabase/browser";

type Props = { tripId: string };

const HOST_CTA: Record<
  HostStepKey,
  { label: string; next?: HostStepKey; href?: "connect" | "settle" }
> = {
  connect: { label: "자동 수집 연결하기", href: "connect" },
  invite: { label: "다음: 지출 기록", next: "record" },
  record: { label: "다음: 분담 조정", next: "adjust" },
  adjust: { label: "다음: 정산하기", next: "settle" },
  settle: { label: "정산 화면 열기", href: "settle" },
  pay: { label: "정산 화면 열기", href: "settle" },
};

export function TripJourney({ tripId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, provider, isReady, isLoggedIn } = useAuth();
  const isAnonymous = Boolean(user?.is_anonymous);
  const role: JourneyRole = isAnonymous ? "guest" : "host";

  const automation = useAutomationStatus({
    enabled: isReady && isLoggedIn && provider !== "guest" && !isAnonymous,
    lite: true,
  });

  const [memberCount, setMemberCount] = useState(1);
  const [expenseCount, setExpenseCount] = useState(0);
  const [memberRows, setMemberRows] = useState<TripMember[]>([]);
  const [expenseRows, setExpenseRows] = useState<LedgerExpenseRow[]>([]);
  const [pendingReviewCount, setPendingReviewCount] = useState(0);
  const [settlement, setSettlement] = useState<JourneySettlement | null>(null);
  const [settlementStale, setSettlementStale] = useState(false);
  const [myShareKrw, setMyShareKrw] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase || !user || provider === "guest") {
      setReady(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      const [members, expenses, latest, pendingRes] = await Promise.all([
        listMembers(supabase, tripId),
        listExpenses(supabase, tripId),
        fetchLatestSettlement(supabase, tripId),
        supabase
          .from("agent_events")
          .select("id", { count: "exact", head: true })
          .eq("trip_id", tripId)
          .eq("user_id", user.id)
          .in("status", ["received", "processing", "needs_review", "failed"]),
      ]);
      if (cancelled) return;
      setMemberCount(Math.max(1, members.length));
      setExpenseCount(expenses.length);
      setMemberRows(members);
      setExpenseRows(expenses);
      setPendingReviewCount(pendingRes.count ?? 0);
      const me = members.find((m) => m.userId === user.id);
      const liveBalances = computeBalances(
        members.map((m) => m.id),
        expenses.map((e) => ({
          id: e.id,
          paidBy: e.paidBy,
          krwAmount: e.krwAmount,
          shares: e.shares ?? {},
        }))
      );
      if (me) {
        setMyShareKrw(liveBalances[me.id] ?? 0);
      } else {
        setMyShareKrw(null);
      }
      if (latest.ok && latest.settlement) {
        const s = latest.settlement;
        const transfersTotal = s.transfers.length;
        const transfersPaid = s.transfers.filter(
          (t) => t.status === "paid"
        ).length;
        setSettlement({
          status: s.status,
          transfersTotal,
          transfersPaid,
        });
        setSettlementStale(s.status === "stale");
      } else {
        setSettlement(null);
        setSettlementStale(false);
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [tripId, user, provider, reloadTick]);

  const automationState: "connected" | "off" | "unknown" = useMemo(() => {
    if (!automation.data) return "unknown";
    if (automation.data.hasActiveToken) return "connected";
    return "off";
  }, [automation.data]);

  const journey = useMemo(
    () =>
      deriveJourney({
        role,
        automation: automationState,
        memberCount,
        expenseCount,
        pendingReviewCount,
        pendingProposalCount: 0,
        settlement,
      }),
    [
      role,
      automationState,
      memberCount,
      expenseCount,
      pendingReviewCount,
      settlement,
    ]
  );

  const addParam = searchParams.get("add");
  const rawStep = searchParams.get("step");
  const forcedRecord =
    !isAnonymous &&
    (addParam === "receipt" || addParam === "manual" || addParam === "voice");

  const currentStep: JourneyStepKey = useMemo(() => {
    if (forcedRecord) return "record";
    return resolveStepParam(rawStep, journey.defaultStep, role);
  }, [forcedRecord, rawStep, journey.defaultStep, role]);

  useEffect(() => {
    if (!ready) return;
    if (role === "guest" && rawStep && !isGuestStepKey(rawStep)) {
      const q = new URLSearchParams(searchParams.toString());
      q.set("step", String(journey.defaultStep));
      router.replace(`?${q.toString()}`, { scroll: false });
      return;
    }
    if (forcedRecord && rawStep !== "record") {
      const q = new URLSearchParams(searchParams.toString());
      q.set("step", "record");
      router.replace(`?${q.toString()}`, { scroll: false });
      return;
    }
    if (!rawStep && !forcedRecord) {
      const q = new URLSearchParams(searchParams.toString());
      q.set("step", String(journey.defaultStep));
      router.replace(`?${q.toString()}`, { scroll: false });
    }
  }, [
    ready,
    role,
    forcedRecord,
    rawStep,
    journey.defaultStep,
    router,
    searchParams,
  ]);

  const goStep = useCallback(
    (key: string) => {
      if (role === "host" && !isHostStepKey(key)) return;
      if (role === "guest" && !isGuestStepKey(key)) return;
      const q = new URLSearchParams(searchParams.toString());
      q.set("step", key);
      q.delete("add");
      router.push(`?${q.toString()}`, { scroll: false });
    },
    [router, searchParams, role]
  );

  const hostStep =
    role === "host" && isHostStepKey(currentStep) ? currentStep : null;
  const guestStep: GuestStepKey | null =
    role === "guest" && isGuestStepKey(currentStep) ? currentStep : null;

  const cta = (() => {
    if (!hostStep) return null;
    // 기록·분담 단계는 RecordStep·AdjustStep 이 자기 BottomCTA 를 직접 그려요.
    if (hostStep === "record" || hostStep === "adjust") return null;
    if (hostStep === "connect" && automationState === "connected") {
      return { label: "다음: 멤버 초대", next: "invite" as HostStepKey };
    }
    if (hostStep === "invite" && memberCount >= 2) {
      return { label: "다음: 지출 기록", next: "record" as HostStepKey };
    }
    return HOST_CTA[hostStep];
  })();

  const onCta = () => {
    if (!cta) return;
    if ("href" in cta && cta.href === "connect") {
      router.push(`/trips/${tripId}/ledger/connect`);
      return;
    }
    if ("href" in cta && cta.href === "settle") {
      router.push(`/trips/${tripId}/ledger/settle`);
      return;
    }
    if ("next" in cta && cta.next) goStep(cta.next);
  };

  const stepsForUi = journey.steps.map((s) => {
    if (s.key === currentStep) {
      return {
        ...s,
        status: (s.status === "attention" ? "attention" : "current") as
          | "attention"
          | "current",
      };
    }
    if (s.status === "current") {
      return { ...s, status: "todo" as const };
    }
    return s;
  });

  let body: React.ReactNode;
  if (role === "guest" && guestStep) {
    if (guestStep === "share") {
      body = (
        <GuestShare
          tripId={tripId}
          myShareKrw={myShareKrw}
          settlementReady={Boolean(settlement)}
          stale={settlementStale}
          onGoPay={() => goStep("pay")}
          onGoAdjust={() => goStep("adjust")}
          onRefresh={() => setReloadTick((n) => n + 1)}
        />
      );
    } else if (guestStep === "adjust") {
      body = user ? (
        <GuestAdjust
          tripId={tripId}
          userId={user.id}
          members={memberRows}
          expenses={expenseRows}
          onChanged={() => setReloadTick((n) => n + 1)}
          onBack={() => goStep("share")}
        />
      ) : null;
    } else if (guestStep === "pay") {
      body = (
        <GuestPay
          tripId={tripId}
          hasTransfers={Boolean(settlement && settlement.transfersTotal > 0)}
        />
      );
    } else {
      body = <GuestDone tripId={tripId} />;
    }
  } else if (hostStep) {
    body = (
      <LedgerShell tripId={tripId} step={hostStep} onNavigate={goStep} />
    );
  } else {
    body = null;
  }

  return (
    <ToastProvider>
      <div className="mu-root mx-auto flex min-h-dvh w-full max-w-mobile flex-col bg-mu-bg">
        <OfflineBanner />
        <Stepper
          steps={stepsForUi}
          currentKey={currentStep}
          onSelect={goStep}
          onBack={() => router.push("/agent")}
          title={
            stepsForUi.find((s) => s.key === currentStep)?.label ?? "가계부"
          }
        />
        <div className="flex-1 overflow-y-auto">{body}</div>
        {role === "host" && cta ? (
          <BottomCTA label={cta.label} onClick={onCta} />
        ) : null}
      </div>
    </ToastProvider>
  );
}
