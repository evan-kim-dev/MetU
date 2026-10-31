"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CardProfileSettings } from "@/components/ledger/CardProfileSettings";
import { CashRateSettings } from "@/components/ledger/CashRateSettings";
import { ExpenseConfirmSheet } from "@/components/ledger/ExpenseConfirmSheet";
import { LedgerDashboard } from "@/components/ledger/LedgerDashboard";
import { PasteExpenseBox } from "@/components/ledger/PasteExpenseBox";
import { ReceiptUploader } from "@/components/ledger/ReceiptUploader";
import { VoiceInputButton } from "@/components/ledger/VoiceInputButton";
import { TripInvitePanel } from "@/components/trips/ledger/TripInvitePanel";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { ExpenseDraftInput } from "@/lib/ledger/draft";
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

type Props = { tripId: string };

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

export function LedgerShell({ tripId }: Props) {
  const { user, provider } = useAuth();
  const searchParams = useSearchParams();
  const intent = readEntryIntent(searchParams);
  const handledIntent = useRef<string | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);
  const voiceRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
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
    const [e, p, pendingRes] = await Promise.all([
      listExpenses(supabase, tripId),
      listCardProfiles(supabase),
      supabase
        .from("agent_events")
        .select("id", { count: "exact", head: true })
        .eq("trip_id", tripId)
        .eq("user_id", user.id)
        .in("status", ["received", "processing", "needs_review", "failed"]),
    ]);
    setMembers(m);
    setExpenses(e);
    setProfiles(p as typeof profiles);
    setInboxCount(pendingRes.count ?? 0);
    setLoading(false);
  }, [tripId, user, provider]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const total = expenses.reduce((s, e) => s + e.krwAmount, 0);
  const me = members.find((m) => m.userId === user?.id) ?? members[0];

  function openDrafts(drafts: ExpenseDraftInput[]) {
    setQueue(drafts);
    setQueueIndex(0);
  }

  // 가계부 탭의 바로가기: manual 은 확인 시트를 열고, 나머지는 해당 섹션으로
  // 스크롤 + 첫 버튼에 포커스만 준다. 파일 선택창은 사용자 제스처가 필요해서 열지 않는다.
  const canEnter = !loading && members.length > 0;
  useEffect(() => {
    if (!intent || !canEnter || handledIntent.current === intent) return;
    handledIntent.current = intent;
    if (intent === "manual") {
      setQueue([newManualDraft()]);
      setQueueIndex(0);
      return;
    }
    const target =
      intent === "receipt"
        ? receiptRef.current
        : intent === "voice"
          ? voiceRef.current
          : settingsRef.current;
    if (!target) return;
    target.scrollIntoView?.({ block: "center" });
    target.querySelector<HTMLElement>("button, input, select")?.focus();
  }, [intent, canEnter]);

  if (loading) {
    return (
      <div className="h-48 animate-pulse rounded-2xl bg-surface-soft" aria-busy />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-ink-heading">가계부</h1>
          <p className="text-xs text-ink-muted">합계 {formatKRW(total)}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/trips/${tripId}/ledger/inbox`}
            className="relative text-xs font-bold text-brand"
          >
            인박스
            {inboxCount > 0 ? (
              <span className="absolute -right-3 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-extrabold text-white">
                {inboxCount > 9 ? "9+" : inboxCount}
              </span>
            ) : null}
          </Link>
          <Link
            href={`/trips/${tripId}`}
            className="text-xs font-bold text-brand"
          >
            여행으로
          </Link>
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
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg bg-brand px-3 py-2 text-xs font-bold text-white"
              onClick={() => openDrafts([newManualDraft()])}
            >
              직접 입력
            </button>
          </div>

          <PasteExpenseBox
            tripId={tripId}
            onDrafts={openDrafts}
            onCancelNotice={setCancelNotice}
          />
          <div ref={receiptRef}>
            <ReceiptUploader
              tripId={tripId}
              onDraft={(d) => openDrafts([d])}
            />
          </div>
          <div ref={voiceRef}>
            <VoiceInputButton
              tripId={tripId}
              onDrafts={openDrafts}
            />
          </div>

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

          <div className="flex flex-wrap gap-3 text-xs font-bold text-brand">
            <Link href={`/trips/${tripId}/ledger/inbox`}>
              인박스{inboxCount > 0 ? ` (${inboxCount})` : ""}
            </Link>
            <Link href={`/trips/${tripId}/ledger/connect`}>자동 수집</Link>
            <Link href={`/trips/${tripId}/ledger/settle`}>정산</Link>
            <Link href={`/trips/${tripId}/ledger/report`}>리포트</Link>
          </div>

          <TripInvitePanel
            tripId={tripId}
            members={members}
            canInvite={Boolean(me?.isOwner && me.userId === user?.id)}
          />

          {cancelNotice ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
              <p className="font-bold text-amber-900">취소 문자예요</p>
              <p className="text-amber-800">
                {cancelNotice.merchant ?? "가맹점"} · {cancelNotice.amount}{" "}
                {cancelNotice.currency}
              </p>
              <button
                type="button"
                className="mt-1 font-bold text-amber-900 underline"
                onClick={() => setCancelNotice(null)}
              >
                닫기
              </button>
            </div>
          ) : null}

          <section className="rounded-2xl bg-surface-white p-4 shadow-sm">
            <h2 className="text-sm font-extrabold text-ink-heading">지출 목록</h2>
            <ul className="mt-2 flex flex-col gap-2">
              {expenses.length === 0 ? (
                <li className="text-xs text-ink-muted">아직 지출이 없어요.</li>
              ) : (
                expenses.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between rounded-lg bg-surface-soft px-3 py-2 text-xs"
                  >
                    <span className="font-semibold text-ink-heading">
                      {e.merchant || e.label}
                    </span>
                    <span className="font-bold">{formatKRW(e.krwAmount)}</span>
                  </li>
                ))
              )}
            </ul>
          </section>

          <div ref={settingsRef} className="flex flex-col gap-4">
            {user ? (
              <CardProfileSettings
                userId={user.id}
                profiles={profiles}
                onChange={setProfiles}
              />
            ) : null}
            {me ? (
              <CashRateSettings tripId={tripId} memberId={me.id} />
            ) : null}
          </div>
        </>
      )}

      {queue.length > 0 ? (
        <ExpenseConfirmSheet
          tripId={tripId}
          members={members}
          drafts={queue}
          index={queueIndex}
          onIndexChange={setQueueIndex}
          onClose={() => setQueue([])}
          onSaved={() => void reload()}
          cardProfiles={profiles}
        />
      ) : null}
    </div>
  );
}
