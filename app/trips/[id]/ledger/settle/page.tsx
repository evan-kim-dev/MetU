"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FxAttribution } from "@/components/fx/FxAttribution";
import { SettlementHistory } from "@/components/ledger/SettlementHistory";
import { useClipboardCopy } from "@/components/onboarding/connect/useClipboardCopy";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  basisHash,
  computeBalances,
  minimizeTransfers,
  type LedgerExpense,
} from "@/lib/ledger/settle";
import {
  PAY_APPS,
  PAY_DEEPLINK_NOTICE,
  PAY_OPEN_FAILED_MESSAGE,
  launchPayApp,
  payAmountText,
  payGuidance,
  type PayApp,
} from "@/lib/ledger/pay-links";
import {
  buildShareText,
  shareReasonMessage,
} from "@/lib/ledger/settle-share";
import {
  fetchLatestSettlement,
  fetchSettlementHistory,
  listExpenses,
  listMembers,
  listVoidedExpenseIds,
  type SettlementHistoryItem,
  type SettlementSnapshot,
} from "@/lib/ledger/supabase";
import type { TripMember } from "@/lib/ledger/types";
import { formatKRW } from "@/lib/shared/format";
import { getBrowserSupabase } from "@/lib/supabase/browser";

function signedKRW(value: number): string {
  if (value > 0) return `+${formatKRW(value)}`;
  if (value < 0) return `-${formatKRW(-value)}`;
  return formatKRW(0);
}

function balanceTone(value: number): string {
  if (value > 0) return "text-emerald-700";
  if (value < 0) return "text-amber-700";
  return "text-ink-muted";
}

function balanceLabel(value: number): string {
  if (value > 0) return "받을 돈";
  if (value < 0) return "보낼 돈";
  return "정산 없음";
}

export default function LedgerSettlePage() {
  const { id: tripId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [members, setMembers] = useState<TripMember[]>([]);
  const [expenses, setExpenses] = useState<LedgerExpense[]>([]);
  const [fxFallbackCount, setFxFallbackCount] = useState(0);
  const [hasForeign, setHasForeign] = useState(false);
  const [settlement, setSettlement] = useState<SettlementSnapshot | null>(null);
  const [history, setHistory] = useState<SettlementHistoryItem[]>([]);
  const [basisState, setBasisState] = useState<{
    source: LedgerExpense[];
    hash: string;
  } | null>(null);
  const [msg, setMsg] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [payNote, setPayNote] = useState("");
  const [origin, setOrigin] = useState("");
  const [canNativeShare, setCanNativeShare] = useState(false);

  const textCopy = useClipboardCopy();
  const linkCopy = useClipboardCopy();
  const amountCopy = useClipboardCopy();
  const payCleanup = useRef<(() => void) | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
    setCanNativeShare(typeof navigator.share === "function");
    return () => payCleanup.current?.();
  }, []);

  const loadSettlement = useCallback(async () => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    const res = await fetchLatestSettlement(supabase, tripId);
    if (!res.ok) {
      setLoadError(true);
      return;
    }
    setSettlement(res.settlement);
    // 이전 버전 공유 링크 목록. 실패해도 현재 정산 화면은 그대로 보여준다(로그는 남김).
    const past = await fetchSettlementHistory(supabase, tripId);
    if (past) setHistory(past);
  }, [tripId]);

  const reload = useCallback(async () => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    const [m, e, voided] = await Promise.all([
      listMembers(supabase, tripId),
      listExpenses(supabase, tripId),
      listVoidedExpenseIds(supabase, tripId),
    ]);
    if (voided === null) setLoadError(true);
    const active = e.filter((row) => !voided?.has(row.id));
    setMembers(m);
    setExpenses(
      active.map((row) => ({
        id: row.id,
        paidBy: row.paidBy,
        krwAmount: row.krwAmount,
        shares: row.shares,
      }))
    );
    setFxFallbackCount(active.filter((row) => row.fxIsFallback).length);
    setHasForeign(
      active.some((row) => row.currency.trim().toUpperCase() !== "KRW")
    );
    await loadSettlement();
    setLoaded(true);
  }, [tripId, loadSettlement]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    let cancelled = false;
    void basisHash(expenses).then((hash) => {
      if (!cancelled) setBasisState({ source: expenses, hash });
    });
    return () => {
      cancelled = true;
    };
  }, [expenses]);

  const balances = useMemo(
    () =>
      computeBalances(
        members.map((m) => m.id),
        expenses
      ),
    [members, expenses]
  );

  const names = useMemo(
    () => Object.fromEntries(members.map((m) => [m.id, m.displayName])),
    [members]
  );
  const nameOf = (id: string) => names[id] ?? "?";

  const me = useMemo(
    () =>
      user ? members.find((m) => m.userId && m.userId === user.id) : undefined,
    [members, user]
  );

  // 현재 지출 목록 기준으로 계산이 끝난 해시만 비교한다(로딩 중 깜빡임 방지).
  const basis =
    loaded && basisState && basisState.source === expenses
      ? basisState.hash
      : "";
  const transfers = useMemo(() => settlement?.transfers ?? [], [settlement]);
  const status = settlement?.status ?? "";
  const sharePath = settlement?.shareToken ? `/s/${settlement.shareToken}` : "";
  const shareUrl = sharePath && origin ? `${origin}${sharePath}` : "";

  const stale = Boolean(
    settlement &&
      (settlement.status === "stale" ||
        (basis && basis !== settlement.basisHash))
  );
  const hasPaid = transfers.some((t) => t.status === "paid");
  const allPaid =
    transfers.length > 0 && transfers.every((t) => t.status === "paid");
  const completed = status === "completed" || allPaid;

  const shareResult = useMemo(() => {
    if (!settlement || transfers.length === 0) return null;
    return buildShareText({
      names,
      transfers,
      balances,
      shareUrl: shareUrl || null,
      fxFallbackCount,
    });
  }, [settlement, transfers, names, balances, shareUrl, fxFallbackCount]);

  const shareText = !stale && shareResult?.ok ? shareResult.text : null;
  const shareBlockedMessage = stale
    ? "지출이 바뀌어서 공유 문구를 만들 수 없어요. 정산을 다시 계산해 주세요."
    : shareResult && !shareResult.ok
      ? shareReasonMessage(shareResult.reason)
      : "";

  async function createSettlement() {
    const supabase = getBrowserSupabase();
    if (!supabase || !user) return;
    const hash = await basisHash(expenses);
    const transfersCalc = minimizeTransfers(balances);
    const { data, error } = await supabase.rpc("create_settlement", {
      p_trip_id: tripId,
      p_basis_hash: hash,
      p_transfers: transfersCalc.map((t) => ({
        from: t.from,
        to: t.to,
        krw: t.krw,
      })),
    });
    if (error || !data) {
      if (error) console.error("[create_settlement]", error.message);
      setMsg("정산 생성 실패 (소유자만 가능)");
      return;
    }
    setPayNote("");
    setMsg("정산을 만들었어요.");
    // 송금 행 id 가 있어야 '송금 완료'가 서버에 저장되므로 새로 읽는다.
    await loadSettlement();
  }

  async function markPaid(transferId: string) {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    const { error } = await supabase.rpc("mark_transfer_paid", {
      p_transfer_id: transferId,
    });
    if (error) {
      console.error("[mark_transfer_paid]", error.message);
      setMsg("완료 처리 실패");
      return;
    }
    setMsg("");
    await loadSettlement();
  }

  async function copyShareText() {
    if (!shareText) return;
    await textCopy.copy(shareText);
  }

  async function copyShareLink() {
    if (!shareUrl) return;
    await linkCopy.copy(shareUrl);
  }

  async function nativeShare() {
    if (!shareText || typeof navigator.share !== "function") return;
    try {
      await navigator.share({
        title: "정산 안내",
        text: shareText,
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      console.error("[navigator.share]", e instanceof Error ? e.message : e);
      setMsg("공유하지 못했어요. 복사해서 보내 주세요.");
    }
  }

  function openPayApp(app: PayApp, krw: number) {
    const amount = payAmountText(krw);
    if (!amount) {
      setMsg("금액을 확인할 수 없어요.");
      return;
    }
    // 클릭 제스처 안에서 복사와 앱 열기를 함께 시작한다.
    void amountCopy.copy(amount).then((ok) => {
      setPayNote((prev) =>
        prev === PAY_OPEN_FAILED_MESSAGE
          ? prev
          : ok
            ? payGuidance(app.label, formatKRW(krw))
            : `금액을 복사하지 못했어요. ${formatKRW(krw)}을 직접 입력해 주세요.`
      );
    });
    setPayNote(payGuidance(app.label, formatKRW(krw)));
    payCleanup.current?.();
    payCleanup.current = launchPayApp(app.id, {
      onFallback: () => setPayNote(PAY_OPEN_FAILED_MESSAGE),
    });
  }

  const isOwner = Boolean(me?.isOwner);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">정산</h1>
        <Link
          href={`/trips/${tripId}/ledger`}
          className="flex min-h-[44px] items-center text-xs font-bold text-brand"
        >
          가계부
        </Link>
      </div>

      {loadError ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
          정산 정보를 모두 불러오지 못했어요. 새로고침해 주세요.
        </p>
      ) : null}

      <section
        aria-label="멤버별 잔액"
        className="rounded-xl bg-surface-soft p-3 text-xs"
      >
        <p className="font-bold">잔액</p>
        <ul className="mt-2 space-y-1">
          {members.map((m) => {
            const value = balances[m.id] ?? 0;
            const mine = me?.id === m.id;
            return (
              <li
                key={m.id}
                data-testid={`balance-${m.id}`}
                data-mine={mine ? "true" : undefined}
                className={`flex min-h-[44px] items-center justify-between rounded-lg px-2 ${
                  mine ? "bg-white ring-1 ring-brand/40" : ""
                }`}
              >
                <span className={mine ? "font-extrabold" : undefined}>
                  {m.displayName}
                  {mine ? " (나)" : ""}
                </span>
                <span className="text-right">
                  <span className={`font-semibold ${balanceTone(value)}`}>
                    {signedKRW(value)}
                  </span>
                  <span className="ml-2 text-[10px] text-ink-muted">
                    {balanceLabel(value)}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {settlement?.origin === "auto" && !completed ? (
        <div className="rounded-xl bg-surface-soft px-3 py-2 text-xs font-semibold text-ink-body">
          자동으로 만든 정산 제안이에요. 금액을 확인하고 직접 송금해 주세요.
        </div>
      ) : null}

      {stale ? (
        <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
          <p>정산 후 지출이 바뀌었어요. 다시 계산할까요?</p>
          {hasPaid ? (
            <p className="mt-1 font-normal">
              이미 송금 표시된 항목이 있어요. 다시 계산하면 새 정산표가
              만들어져요.
            </p>
          ) : null}
        </div>
      ) : null}

      {isOwner ? (
        <button
          type="button"
          className="min-h-[44px] rounded-xl bg-brand py-3 text-sm font-extrabold text-white"
          onClick={() => void createSettlement()}
        >
          {settlement ? "정산 다시 계산하기" : "정산 계산하기"}
        </button>
      ) : loaded ? (
        <p className="text-xs text-ink-muted">
          정산표는 여행을 만든 분만 만들 수 있어요. 내 송금은 아래에서 표시할 수
          있어요.
        </p>
      ) : null}

      {completed ? (
        <p
          role="status"
          className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800"
        >
          정산 완료
        </p>
      ) : null}

      {loaded && !settlement ? (
        <p className="text-xs text-ink-muted">
          아직 만든 정산표가 없어요. 위 버튼으로 계산해 보세요.
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {transfers.map((t) => {
          const mineOut = Boolean(me && t.from === me.id);
          const canMark = isOwner || mineOut;
          return (
            <li
              key={t.id}
              className="flex flex-col gap-2 rounded-xl bg-surface-white p-3 text-sm shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <span>
                  {nameOf(t.from)} → {nameOf(t.to)}{" "}
                  <strong>{formatKRW(t.krw)}</strong>
                </span>
                {t.status === "paid" ? (
                  <span className="text-xs font-bold text-emerald-700">
                    완료
                  </span>
                ) : canMark ? (
                  <button
                    type="button"
                    className="min-h-[44px] min-w-[44px] px-2 text-xs font-bold text-brand"
                    onClick={() => void markPaid(t.id)}
                  >
                    송금 완료
                  </button>
                ) : null}
              </div>
              {t.status !== "paid" && mineOut && !stale ? (
                <div className="flex flex-wrap gap-2">
                  {PAY_APPS.map((app) => (
                    <button
                      key={app.id}
                      type="button"
                      className="min-h-[44px] rounded-lg border border-brand px-3 text-xs font-bold text-brand"
                      onClick={() => openPayApp(app, t.krw)}
                    >
                      {app.label} 열기
                    </button>
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {payNote ? (
        <div
          role="status"
          className="rounded-xl bg-surface-soft px-3 py-2 text-xs text-ink-body"
        >
          <p>{payNote}</p>
          <p className="mt-1 font-semibold">{PAY_DEEPLINK_NOTICE}</p>
          {amountCopy.label ? (
            <p className="mt-1 text-ink-muted">{amountCopy.label}</p>
          ) : null}
        </div>
      ) : null}

      {settlement && transfers.length > 0 ? (
        <section
          aria-label="정산 공유"
          className="flex flex-col gap-2 rounded-xl bg-surface-soft p-3 text-xs"
        >
          <p className="font-bold">동행에게 공유하기</p>
          {shareBlockedMessage ? (
            <p className="font-semibold text-amber-900">
              {shareBlockedMessage}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!shareText}
              className="min-h-[44px] rounded-lg bg-brand px-3 font-bold text-white disabled:opacity-40"
              onClick={() => void copyShareText()}
            >
              {textCopy.label ?? "문구 복사"}
            </button>
            {canNativeShare ? (
              <button
                type="button"
                disabled={!shareText}
                className="min-h-[44px] rounded-lg border border-brand px-3 font-bold text-brand disabled:opacity-40"
                onClick={() => void nativeShare()}
              >
                공유하기
              </button>
            ) : null}
            {shareUrl ? (
              <button
                type="button"
                className="min-h-[44px] rounded-lg border border-brand px-3 font-bold text-brand"
                onClick={() => void copyShareLink()}
              >
                {linkCopy.label ?? "링크 복사"}
              </button>
            ) : null}
          </div>
          {sharePath ? (
            <Link className="break-all text-brand" href={sharePath}>
              {sharePath}
            </Link>
          ) : null}
        </section>
      ) : null}

      <SettlementHistory
        items={history}
        currentId={settlement?.id ?? null}
        origin={origin}
      />

      {msg ? <p className="text-xs text-ink-muted">{msg}</p> : null}

      <footer className="flex flex-col gap-1 text-[10px] leading-snug text-ink-muted">
        <p>
          정산은 원화 기준이에요. 외화 지출은 기록할 때의 환율로 바꾼 금액이고,
          송금은 각자 앱에서 직접 해 주세요.
        </p>
        {fxFallbackCount > 0 ? (
          <p
            role="alert"
            className="rounded-lg bg-amber-50 px-2 py-1 font-semibold text-amber-900"
          >
            {fxFallbackCount}건은 마지막으로 확인한 환율로 계산됐어요. 송금하기
            전에 금액을 한 번 더 확인해 주세요.
          </p>
        ) : null}
        {hasForeign ? <FxAttribution /> : null}
      </footer>
    </div>
  );
}
