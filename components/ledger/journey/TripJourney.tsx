"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BottomCTA } from "@/components/ds/BottomCTA";
import { Stepper } from "@/components/ds/Stepper";
import { ToastProvider } from "@/components/ds/Toast";
import { LedgerShell } from "@/components/ledger/LedgerShell";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useAutomationStatus } from "@/lib/hooks/useAutomationStatus";
import {
  deriveJourney,
  isHostStepKey,
  resolveStepParam,
  type HostStepKey,
  type JourneySettlement,
} from "@/lib/ledger/journey-state";
import {
  fetchLatestSettlement,
  listExpenses,
  listMembers,
} from "@/lib/ledger/supabase";
import { getBrowserSupabase } from "@/lib/supabase/browser";

type Props = { tripId: string };

const CTA: Record<
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
  const automation = useAutomationStatus({
    enabled: isReady && isLoggedIn && provider !== "guest",
    lite: true,
  });

  const [memberCount, setMemberCount] = useState(1);
  const [expenseCount, setExpenseCount] = useState(0);
  const [pendingReviewCount, setPendingReviewCount] = useState(0);
  const [settlement, setSettlement] = useState<JourneySettlement | null>(null);
  const [ready, setReady] = useState(false);

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
      setPendingReviewCount(pendingRes.count ?? 0);
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
      } else {
        setSettlement(null);
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [tripId, user, provider]);

  const automationState: "connected" | "off" | "unknown" = useMemo(() => {
    if (!automation.data) return "unknown";
    if (automation.data.hasActiveToken) return "connected";
    return "off";
  }, [automation.data]);

  const journey = useMemo(
    () =>
      deriveJourney({
        role: "host",
        automation: automationState,
        memberCount,
        expenseCount,
        pendingReviewCount,
        pendingProposalCount: 0,
        settlement,
      }),
    [
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
    addParam === "receipt" || addParam === "manual" || addParam === "voice";

  const currentStep: HostStepKey = useMemo(() => {
    if (forcedRecord) return "record";
    const resolved = resolveStepParam(rawStep, journey.defaultStep, "host");
    return isHostStepKey(resolved) ? resolved : "record";
  }, [forcedRecord, rawStep, journey.defaultStep]);

  useEffect(() => {
    if (!ready) return;
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
    forcedRecord,
    rawStep,
    journey.defaultStep,
    router,
    searchParams,
  ]);

  const goStep = useCallback(
    (key: string) => {
      if (!isHostStepKey(key)) return;
      const q = new URLSearchParams(searchParams.toString());
      q.set("step", key);
      q.delete("add");
      router.push(`?${q.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const cta = (() => {
    if (currentStep === "connect" && automationState === "connected") {
      return { label: "다음: 멤버 초대", next: "invite" as HostStepKey };
    }
    if (currentStep === "invite" && memberCount >= 2) {
      return { label: "다음: 지출 기록", next: "record" as HostStepKey };
    }
    return CTA[currentStep];
  })();
  const onCta = () => {
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
        <div className="flex-1 overflow-y-auto">
          <LedgerShell
            tripId={tripId}
            step={currentStep}
            onNavigate={goStep}
          />
        </div>
        <BottomCTA label={cta.label} onClick={onCta} />
      </div>
    </ToastProvider>
  );
}
