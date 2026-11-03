"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Settings } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CardProfileSettings } from "@/components/ledger/CardProfileSettings";
import { CashRateSettings } from "@/components/ledger/CashRateSettings";
import { ExpenseConfirmSheet } from "@/components/ledger/ExpenseConfirmSheet";
import { ExpenseChipSplit } from "@/components/ledger/ExpenseChipSplit";
import { GuestExpenseSlot } from "@/components/ledger/GuestExpenseSlot";
import { LedgerDashboard } from "@/components/ledger/LedgerDashboard";
import { AdjustStep } from "@/components/ledger/journey/host/AdjustStep";
import { ConnectStep } from "@/components/ledger/journey/host/ConnectStep";
import { InviteStep } from "@/components/ledger/journey/host/InviteStep";
import { RecordStep } from "@/components/ledger/journey/host/RecordStep";
import { SettleStep } from "@/components/ledger/journey/host/SettleStep";
import {
  AddExpenseSheet,
  type AddExpenseTab,
} from "@/components/ledger/journey/host/AddExpenseSheet";
import { Sheet } from "@/components/ds/Sheet";
import { useOptionalToast } from "@/components/ds/Toast";
import { useAuth } from "@/lib/auth/AuthProvider";
import { TABLES } from "@/lib/constants";
import type { ExpenseDraftInput } from "@/lib/ledger/draft";
import type { HostStepKey } from "@/lib/ledger/journey-state";
import {
  buildLocalInsight,
  computeLedgerStats,
} from "@/lib/ledger/stats";
import {
  ensureOwnerMember,
  listCardProfiles,
  listExpenses,
  listMembers,
} from "@/lib/ledger/supabase";
import type { LedgerExpenseRow, TripMember } from "@/lib/ledger/types";
import { formatKRW } from "@/lib/shared/format";
import { getBrowserSupabase } from "@/lib/supabase/browser";

type Props = {
  tripId: string;
  /** UX-S1: 여정 단계. 기본 record (기존 한 페이지와 동일 블록). */
  step?: HostStepKey;
  onNavigate?: (step: HostStepKey) => void;
};

/** 가계부 탭에서 넘어오는 ?add= / ?settings= 값. 알 수 없는 값은 무시한다. */
type EntryIntent = "manual" | "receipt" | "voice" | "settings-fx";

function readEntryIntent(params: URLSearchParams): EntryIntent | null {
  const add = params.get("add");
  if (add === "manual" || add === "receipt" || add === "voice") return add;
  if (params.get("settings") === "fx") return "settings-fx";
  return null;
}

function newManualDraft(): ExpenseDraftInput {
  return {
    source: "manual",
    origin: "manual",
    merchant: "",
    amount: null,
    currency: "KRW",
    spentOn: new Date().toISOString().slice(0, 10),
    category: "기타",
    paymentMethod: "card",
    kind: "approval",
  };
}

export function LedgerShell({
  tripId,
  step = "record",
  onNavigate,
}: Props) {
  const { user, provider, isAnonymous } = useAuth();
  const searchParams = useSearchParams();
  const intent = readEntryIntent(searchParams);
  /** UI 숨김만. 권한은 서버 라우트·RLS가 최종 방어. */
  const guestReadonly = isAnonymous;
  const handledIntent = useRef<string | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const toast = useOptionalToast();
  const [addTab, setAddTab] = useState<AddExpenseTab | null>(null);
  const [addFocusFirst, setAddFocusFirst] = useState(false);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [expenses, setExpenses] = useState<LedgerExpenseRow[]>([]);
  const [profiles, setProfiles] = useState<
    Array<{
      id: string;
      label: string;
      kind: string;
      fee_rate: number | null;
      fee_flat_krw: number;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [queue, setQueue] = useState<ExpenseDraftInput[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [cancelNotice, setCancelNotice] = useState<ExpenseDraftInput | null>(
    null
  );
  const [budget] = useState(0);
  const [insight, setInsight] = useState<ReturnType<
    typeof buildLocalInsight
  > | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [inboxCount, setInboxCount] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const reload = useCallback(async () => {
    const supabase = getBrowserSupabase();
    if (!supabase || !user || provider === "guest") {
      setLoading(false);
      setError("가계부는 로그인 후 이용할 수 있어요.");
      return;
    }
    setError("");
    let m = await listMembers(supabase, tripId);
    if (m.length === 0) {
      await ensureOwnerMember(
        supabase,
        tripId,
        user.id,
        user.user_metadata?.name?.trim() ||
          user.user_metadata?.nickname?.trim() ||
          "나"
      );
      m = await listMembers(supabase, tripId);
    }
    const owner = m.find((row) => row.isOwner && row.userId === user.id);
    const [e, p, pendingRes, proposalRes] = await Promise.all([
      listExpenses(supabase, tripId),
      listCardProfiles(supabase),
      supabase
        .from("agent_events")
        .select("id", { count: "exact", head: true })
        .eq("trip_id", tripId)
        .eq("user_id", user.id)
        .in("status", ["received", "processing", "needs_review", "failed"]),
      owner
        ? supabase
            .from(TABLES.tripExpenseProposals)
            .select("id", { count: "exact", head: true })
            .eq("trip_id", tripId)
            .eq("status", "pending")
        : Promise.resolve({ count: 0 }),
    ]);
    setMembers(m);
    setExpenses(e);
    setProfiles(p as typeof profiles);
    setInboxCount((pendingRes.count ?? 0) + (proposalRes.count ?? 0));
    setLoading(false);
  }, [tripId, user, provider]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const total = expenses.reduce((s, e) => s + e.krwAmount, 0);
  const me = members.find((m) => m.userId === user?.id) ?? members[0];

  function openDrafts(drafts: ExpenseDraftInput[]) {
    setAddTab(null);
    setQueue(drafts);
    setQueueIndex(0);
  }

  function openAdd(tab: AddExpenseTab) {
    setAddFocusFirst(false);
    setAddTab(tab);
  }

  // 가계부 탭의 바로가기: manual 은 확인 시트를 바로 열고, receipt/voice 는 지출 추가 시트를
  // 그 탭으로 열어 첫 버튼에 포커스만 준다. 파일 선택창은 사용자 제스처가 필요해서 열지 않는다.
  const canEnter = !loading && members.length > 0 && !guestReadonly;
  useEffect(() => {
    if (!intent || !canEnter || handledIntent.current === intent) return;
    handledIntent.current = intent;
    if (intent === "manual") {
      setQueue([newManualDraft()]);
      setQueueIndex(0);
      return;
    }
    if (intent === "settings-fx") {
      setSettingsOpen(true);
      return;
    }
    // receipt/voice: record 단계에서만 (TripJourney가 step=record로 정규화)
    if (step !== "record") return;
    setAddFocusFirst(true);
    setAddTab(intent === "receipt" ? "receipt" : "voice");
  }, [intent, canEnter, step]);

  if (loading) {
    return (
      <div className="h-48 animate-pulse rounded-2xl bg-surface-soft" aria-busy />
    );
  }

  const showConnect = step === "connect";
  const showInvite = step === "invite";
  const showRecord = step === "record";
  const showAdjust = step === "adjust";
  const showSettle = step === "settle";
  const showPayLink = step === "pay";

  const dashboard = (
    <LedgerDashboard
      expenses={expenses}
      members={members}
      budget={budget || Math.max(total, 1)}
      insight={insight}
      insightLoading={insightLoading}
      onRefreshInsight={() => {
        setInsightLoading(true);
        try {
          const stats = computeLedgerStats({
            expenses,
            budget: budget || Math.max(total, 1),
          });
          setInsight(buildLocalInsight(stats));
        } finally {
          setInsightLoading(false);
        }
      }}
    />
  );

  const expenseList = (
    <section className="rounded-2xl bg-surface-white p-4 shadow-sm">
      <h2 className="text-sm font-extrabold text-ink-heading">지출 목록</h2>
      <ul className="mt-2 flex flex-col gap-2">
        {expenses.length === 0 ? (
          <li className="text-xs text-ink-muted">아직 지출이 없어요.</li>
        ) : (
          expenses.map((e) => (
            <ExpenseChipSplit
              key={e.id}
              expense={e}
              members={members}
              meId={me?.id}
              isAnonymous={isAnonymous}
              isOwner={Boolean(me?.isOwner)}
              settleHref={`/trips/${tripId}/ledger/settle`}
              onChanged={() => void reload()}
            />
          ))
        )}
      </ul>
    </section>
  );

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pb-28 pt-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-ink-muted">합계 {formatKRW(total)}</p>
        </div>
        <div className="flex items-center gap-2">
          {!guestReadonly ? (
            <Link
              href={`/trips/${tripId}/ledger/inbox`}
              className="relative min-h-[44px] text-xs font-bold text-brand"
            >
              인박스
              {inboxCount > 0 ? (
                <span className="absolute -right-3 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-extrabold text-white">
                  {inboxCount > 9 ? "9+" : inboxCount}
                </span>
              ) : null}
            </Link>
          ) : null}
          {!guestReadonly ? (
            <button
              type="button"
              aria-label="설정"
              className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-body"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">
          {error}
        </p>
      ) : null}

      {members.length === 0 ? (
        <p className="text-sm text-ink-body">동행자를 먼저 추가해 주세요.</p>
      ) : (
        <>
          {showConnect && !guestReadonly ? (
            <ConnectStep
              tripId={tripId}
              onLater={() => onNavigate?.("invite")}
            />
          ) : null}

          {showInvite && !guestReadonly ? (
            <InviteStep
              tripId={tripId}
              members={members}
              canInvite={Boolean(me?.isOwner && me.userId === user?.id)}
              onMembersChanged={setMembers}
            />
          ) : null}

          {showRecord ? (
            <>
              {guestReadonly && user && me ? (
                <GuestExpenseSlot
                  tripId={tripId}
                  members={members}
                  meId={me.id}
                  userId={user.id}
                />
              ) : guestReadonly ? (
                <p className="text-xs text-ink-muted">
                  호스트가 승인하면 정산에 들어가요.
                </p>
              ) : null}

              {guestReadonly ? (
                <>
                  {dashboard}
                  <div className="flex flex-wrap gap-3 text-xs font-bold text-brand">
                    <Link href={`/trips/${tripId}/ledger/settle`}>정산</Link>
                    <Link href={`/trips/${tripId}/ledger/report`}>리포트</Link>
                  </div>
                  {expenseList}
                </>
              ) : (
                <RecordStep
                  tripId={tripId}
                  expenses={expenses}
                  members={members}
                  inboxCount={inboxCount}
                  cancelNotice={cancelNotice}
                  onDismissCancel={() => setCancelNotice(null)}
                  onOpenAdd={openAdd}
                  onAdjust={() => onNavigate?.("adjust")}
                  dashboard={dashboard}
                />
              )}
            </>
          ) : null}

          {showAdjust ? (
            <AdjustStep
              tripId={tripId}
              expenses={expenses}
              members={members}
              meId={me?.id}
              isOwner={Boolean(me?.isOwner)}
              isAnonymous={isAnonymous}
              onChanged={() => void reload()}
              onSettle={() => onNavigate?.("settle")}
              onRecord={() => onNavigate?.("record")}
            />
          ) : null}

          {showSettle ? (
            <SettleStep
              tripId={tripId}
              mode="journey"
              onAdjust={() => onNavigate?.("adjust")}
            />
          ) : null}

          {showPayLink ? (
            <section className="rounded-2xl border border-line-soft bg-surface-white p-4">
              <h2 className="text-sm font-extrabold text-ink-heading">
                송금을 챙겨요
              </h2>
              <p className="mt-1 text-xs text-ink-muted">
                송금은 정산 화면에서 이어서 해요 (U5 에서 PayStep 으로 옮길 예정)
              </p>
              <Link
                href={`/trips/${tripId}/ledger/settle`}
                className="mt-3 inline-flex min-h-tap items-center rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white"
              >
                정산 화면 열기
              </Link>
            </section>
          ) : null}
        </>
      )}

      {!guestReadonly ? (
        <Sheet
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          title="설정"
        >
          <div ref={settingsRef} className="flex flex-col gap-4">
            {user ? (
              <CardProfileSettings
                userId={user.id}
                profiles={profiles}
                onChange={setProfiles}
              />
            ) : null}
            {me ? <CashRateSettings tripId={tripId} memberId={me.id} /> : null}
            <Link
              href={`/trips/${tripId}/ledger/inbox`}
              className="text-sm font-bold text-brand"
            >
              인박스
            </Link>
            <Link
              href={`/trips/${tripId}/ledger/report`}
              className="text-sm font-bold text-brand"
            >
              리포트
            </Link>
            <Link
              href={`/trips/${tripId}/ledger/wallet`}
              className="text-sm font-bold text-brand"
            >
              면세 지갑
            </Link>
            <Link
              href={`/trips/${tripId}/ledger/recap`}
              className="text-sm font-bold text-brand"
            >
              리캡
            </Link>
          </div>
        </Sheet>
      ) : null}

      {!guestReadonly ? (
        <AddExpenseSheet
          tripId={tripId}
          tab={addTab}
          onTabChange={setAddTab}
          onClose={() => setAddTab(null)}
          focusFirst={addFocusFirst}
          onDrafts={openDrafts}
          onCancelNotice={(draft) => {
            setAddTab(null);
            setCancelNotice(draft);
          }}
          onManual={() => openDrafts([newManualDraft()])}
        />
      ) : null}

      {queue.length > 0 && !guestReadonly ? (
        <ExpenseConfirmSheet
          tripId={tripId}
          members={members}
          drafts={queue}
          index={queueIndex}
          onIndexChange={setQueueIndex}
          onClose={() => setQueue([])}
          onSaved={() => {
            void reload();
            toast?.show({ text: "지출을 저장했어요", tone: "ok" });
          }}
          cardProfiles={profiles}
        />
      ) : null}
    </div>
  );
}
