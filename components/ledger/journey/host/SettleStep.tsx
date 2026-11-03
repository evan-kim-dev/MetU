"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AmountCard } from "@/components/ds/AmountCard";
import { BottomCTA } from "@/components/ds/BottomCTA";
import { ProgressRing } from "@/components/ds/ProgressRing";
import { FxAttribution } from "@/components/fx/FxAttribution";
import { CurrencyTotals } from "@/components/ledger/CurrencyTotals";
import { FeeLeakCard } from "@/components/ledger/FeeLeakCard";
import { MyShareCard } from "@/components/ledger/MyShareCard";
import { SettleExplainSheet } from "@/components/ledger/SettleExplainSheet";
import { SettlementHistory } from "@/components/ledger/SettlementHistory";
import { useSettleReference } from "@/components/ledger/useSettleReference";
import { useClipboardCopy } from "@/components/onboarding/connect/useClipboardCopy";
import { useAuth } from "@/lib/auth/AuthProvider";
import { explainSettlement } from "@/lib/ledger/explain";
import { resolveMyShare } from "@/lib/ledger/my-share";
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
import { totalsByCurrency } from "@/lib/ledger/stats";
import {
  fetchLatestSettlement,
  fetchSettlementHistory,
  listExpenses,
  listMembers,
  listVoidedExpenseIds,
  type SettlementHistoryItem,
  type SettlementSnapshot,
} from "@/lib/ledger/supabase";
import type { LedgerExpenseRow, TripMember } from "@/lib/ledger/types";
import { formatKRW } from "@/lib/shared/format";
import { getBrowserSupabase } from "@/lib/supabase/browser";

function signedKRW(value: number): string {
  if (value > 0) return `+${formatKRW(value)}`;
  if (value < 0) return `-${formatKRW(-value)}`;
  return formatKRW(0);
}

function balanceTone(value: number): string {
  if (value > 0) return "text-mu-ok";
  if (value < 0) return "text-mu-warn";
  return "text-mu-fg-3";
}

function balanceLabel(value: number): string {
  if (value > 0) return "받을 돈";
  if (value < 0) return "보낼 돈";
  return "정산 없음";
}

function toSettleExpense(row: LedgerExpenseRow): LedgerExpense {
  return {
    id: row.id,
    paidBy: row.paidBy,
    krwAmount: row.krwAmount,
    shares: row.shares,
  };
}

type Props = {
  tripId: string;
  /** page = `/ledger/settle` 단독. journey = TripJourney 정산 칸. */
  mode?: "page" | "journey";
  /** journey 모드에서 분담 단계로 이동 */
  onAdjust?: () => void;
};

/**
 * 호스트 ⑤ 정산 단계. 잔액·통화합계·수수료 차이 → 정산표 생성 → 공유·이력.
 * 분담 수정은 AdjustStep 으로 보내고, 송금 UI 는 U5 PayStep 추출 전까지 여기 유지.
 */
export function SettleStep({ tripId, mode = "page", onAdjust }: Props) {
  const { user, isAnonymous } = useAuth();
  const [members, setMembers] = useState<TripMember[]>([]);
  const [expenseRows, setExpenseRows] = useState<LedgerExpenseRow[]>([]);
  const [fxFallbackCount, setFxFallbackCount] = useState(0);
  const [hasForeign, setHasForeign] = useState(false);
  const [expenseLabels, setExpenseLabels] = useState<Record<string, string>>({});
  const [tripCurrencies, setTripCurrencies] = useState<string[]>([]);
  const [explainOpen, setExplainOpen] = useState(false);
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
  const reference = useSettleReference();

  const expenses = useMemo(
    () => expenseRows.map(toSettleExpense),
    [expenseRows]
  );

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
    setExpenseRows(active);
    setFxFallbackCount(active.filter((row) => row.fxIsFallback).length);
    setHasForeign(
      active.some((row) => (row.currency || "KRW").trim().toUpperCase() !== "KRW")
    );
    setExpenseLabels(
      Object.fromEntries(
        active.map((row) => [row.id, row.merchant || row.label || ""])
      )
    );
    setTripCurrencies(
      [
        ...new Set(
          active
            .map((row) => (row.currency || "KRW").trim().toUpperCase())
            .filter((c) => c && c !== "KRW")
        ),
      ].sort()
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

  const currencyTotals = useMemo(
    () => totalsByCurrency(expenseRows),
    [expenseRows]
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
      conversion: reference.shareConversion,
    });
  }, [
    settlement,
    transfers,
    names,
    balances,
    shareUrl,
    fxFallbackCount,
    reference.shareConversion,
  ]);

  // 지출이 바뀐 뒤에는 저장된 송금표가 현재 지출과 달라서 잔액 설명만 보여준다.
  const explainResult = useMemo(
    () =>
      explainSettlement({
        members: members.map((m) => ({ id: m.id, name: m.displayName })),
        expenses: expenses.map((e) => ({
          id: e.id,
          label: expenseLabels[e.id] ?? "",
          paidBy: e.paidBy,
          krwAmount: e.krwAmount,
          shares: e.shares,
        })),
        transfers: stale
          ? []
          : transfers.map((t) => ({ from: t.from, to: t.to, krw: t.krw })),
      }),
    [members, expenses, expenseLabels, transfers, stale]
  );

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
  /** UI 숨김. 정산 생성은 서버 RPC·RLS가 최종 방어. */
  const canCreateSettlement = isOwner && !isAnonymous;
  const totalKrw = expenses.reduce((s, e) => s + e.krwAmount, 0);
  const myBalance = me ? (balances[me.id] ?? 0) : null;
  const myShare = resolveMyShare({
    liveBalance: myBalance,
    hasSettlement: Boolean(settlement),
    stale,
  });
  const paidCount = transfers.filter((t) => t.status === "paid").length;
  const myOutgoingUnpaid = transfers.filter(
    (t) => me && t.from === me.id && t.status !== "paid"
  );

  const adjustHref = `/trips/${tripId}/ledger?step=adjust`;
  const adjustControl =
    onAdjust != null ? (
      <button
        type="button"
        className="inline-flex min-h-tap items-center text-mu-caption font-bold text-mu-accent"
        onClick={onAdjust}
      >
        분담 수정하기
      </button>
    ) : (
      <Link
        href={adjustHref}
        className="inline-flex min-h-tap items-center text-mu-caption font-bold text-mu-accent"
      >
        분담 수정하기
      </Link>
    );

  return (
    <div
      className={
        mode === "page"
          ? "mx-auto flex max-w-lg flex-col gap-4 px-4 py-6 pb-28"
          : "flex flex-col gap-4 pb-24"
      }
    >
      {mode === "page" ? (
        <>
          <Link
            href={`/trips/${tripId}/ledger`}
            className="text-mu-caption font-bold text-mu-accent"
          >
            ← 정산 여정
          </Link>
          <div className="flex items-center justify-between">
            <h1 className="text-mu-title text-mu-fg">정산</h1>
            <Link
              href={`/trips/${tripId}/ledger`}
              className="flex min-h-tap items-center text-mu-caption font-bold text-mu-accent"
            >
              가계부
            </Link>
          </div>
        </>
      ) : (
        <div>
          <h2 className="text-mu-title text-mu-fg">이 금액으로 정산해요</h2>
          <p className="mt-1 text-mu-body text-mu-fg-2">
            멤버 잔액을 확인하고 정산표를 만들어요. 송금은 각자 앱에서 해 주세요.
          </p>
        </div>
      )}

      {loadError ? (
        <p className="rounded-mu-md bg-mu-warn/10 px-3 py-2 text-mu-caption font-semibold text-mu-warn">
          정산 정보를 모두 불러오지 못했어요. 새로고침해 주세요.
        </p>
      ) : null}

      {loaded ? (
        <div className="flex flex-col gap-3">
          {me ? (
            <MyShareCard
              view={myShare}
              action={
                <button
                  type="button"
                  className="min-h-tap text-mu-caption font-bold text-mu-accent"
                  onClick={() => setExplainOpen(true)}
                >
                  왜 이 금액?
                </button>
              }
              payActions={
                myShare.showPayActions && myOutgoingUnpaid.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {myOutgoingUnpaid.map((t) => (
                      <div
                        key={t.id}
                        className="flex flex-wrap items-center gap-2 rounded-mu-md border border-mu-line bg-mu-card p-3"
                      >
                        <p className="w-full text-mu-caption font-bold text-mu-fg">
                          {nameOf(t.to)}에게 {formatKRW(t.krw)}
                        </p>
                        {PAY_APPS.map((app) => (
                          <button
                            key={app.id}
                            type="button"
                            className="min-h-tap rounded-mu-sm border border-mu-accent px-3 text-mu-caption font-bold text-mu-accent"
                            onClick={() => openPayApp(app, t.krw)}
                          >
                            {app.label} 열기
                          </button>
                        ))}
                        <button
                          type="button"
                          className="min-h-tap min-w-tap px-2 text-mu-caption font-bold text-mu-accent"
                          onClick={() => void markPaid(t.id)}
                        >
                          송금 완료
                        </button>
                      </div>
                    ))}
                  </div>
                ) : undefined
              }
            />
          ) : (
            <AmountCard
              label="내 몫"
              amount={0}
              tone="neutral"
              sub="멤버로 합류하면 내 몫이 보여요"
            />
          )}
          <AmountCard label="총액" amount={totalKrw} tone="neutral" />
        </div>
      ) : null}

      <section
        aria-label="멤버별 잔액"
        className="rounded-mu-md border border-mu-line bg-mu-card p-3 text-mu-caption"
      >
        <p className="font-bold text-mu-fg">잔액</p>
        <ul className="mt-2 space-y-1">
          {members.map((m) => {
            const value = balances[m.id] ?? 0;
            const mine = me?.id === m.id;
            return (
              <li
                key={m.id}
                data-testid={`balance-${m.id}`}
                data-mine={mine ? "true" : undefined}
                className={`flex min-h-tap items-center justify-between rounded-mu-sm px-2 ${
                  mine ? "bg-mu-bg ring-1 ring-mu-accent/40" : ""
                }`}
              >
                <span className={mine ? "font-extrabold" : undefined}>
                  {m.displayName}
                  {mine ? " (나)" : ""}
                </span>
                <span className="text-right">
                  <span className={`mu-num font-semibold ${balanceTone(value)}`}>
                    {signedKRW(value)}
                  </span>
                  <span className="ml-2 text-mu-caption text-mu-fg-3">
                    {balanceLabel(value)}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {loaded ? (
        <CurrencyTotals totals={currencyTotals} totalKrw={totalKrw} />
      ) : null}

      {loaded ? <FeeLeakCard expenses={expenseRows} /> : null}

      {loaded ? (
        <div className="rounded-mu-md border border-mu-line bg-mu-card px-3 py-2">
          <p className="text-mu-caption text-mu-fg-2">
            사람별 몫이 안 맞으면 분담을 먼저 고쳐 주세요.
          </p>
          {adjustControl}
        </div>
      ) : null}

      {settlement?.origin === "auto" && !completed ? (
        <div className="rounded-mu-md bg-mu-bg px-3 py-2 text-mu-caption font-semibold text-mu-fg-2">
          자동으로 만든 정산 제안이에요. 금액을 확인하고 직접 송금해 주세요.
        </div>
      ) : null}

      {stale ? (
        <div className="rounded-mu-md bg-mu-warn/10 px-3 py-2 text-mu-caption font-semibold text-mu-warn">
          <p>정산 후 지출이 바뀌었어요. 다시 계산할까요?</p>
          {hasPaid ? (
            <p className="mt-1 font-normal">
              이미 송금 표시된 항목이 있어요. 다시 계산하면 새 정산표가
              만들어져요.
            </p>
          ) : null}
        </div>
      ) : null}

      {!canCreateSettlement && loaded ? (
        <p className="text-mu-caption text-mu-fg-3">
          {isAnonymous
            ? "호스트가 정산을 계산해요. 내 송금은 아래에서 표시할 수 있어요."
            : "정산표는 여행을 만든 분만 만들 수 있어요. 내 송금은 아래에서 표시할 수 있어요."}
        </p>
      ) : null}

      {completed ? (
        <p
          role="status"
          className="rounded-mu-md bg-mu-ok/10 px-3 py-2 text-mu-caption font-bold text-mu-ok"
        >
          정산 완료
        </p>
      ) : null}

      {loaded && !settlement && canCreateSettlement ? (
        <p className="text-mu-caption text-mu-fg-3">
          아직 만든 정산표가 없어요. 아래 버튼으로 계산해 보세요.
        </p>
      ) : null}

      {settlement && transfers.length > 0 ? (
        <div className="flex items-center gap-3 rounded-mu-md border border-mu-line bg-mu-card p-3">
          <ProgressRing
            value={paidCount}
            max={transfers.length}
            size={72}
            label={`${paidCount}/${transfers.length} 송금 완료`}
          />
          <p className="text-mu-body font-bold text-mu-fg">
            {paidCount}/{transfers.length} 완료
          </p>
        </div>
      ) : null}

      <ul className="flex flex-col gap-2">
        {transfers.map((t) => {
          const mineOut = Boolean(me && t.from === me.id);
          const canMark = isOwner || mineOut;
          return (
            <li
              key={t.id}
              className="flex flex-col gap-2 rounded-mu-md border border-mu-line bg-mu-card p-3 text-mu-body"
            >
              <div className="flex items-center justify-between gap-2">
                <span>
                  {nameOf(t.from)} → {nameOf(t.to)}{" "}
                  <strong className="mu-num">{formatKRW(t.krw)}</strong>
                </span>
                {t.status === "paid" ? (
                  <span className="text-mu-caption font-bold text-mu-ok">
                    완료
                  </span>
                ) : canMark ? (
                  <button
                    type="button"
                    className="min-h-tap min-w-tap px-2 text-mu-caption font-bold text-mu-accent"
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
                      className="min-h-tap rounded-mu-sm border border-mu-accent px-3 text-mu-caption font-bold text-mu-accent"
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
          className="rounded-mu-md bg-mu-bg px-3 py-2 text-mu-caption text-mu-fg-2"
        >
          <p>{payNote}</p>
          <p className="mt-1 font-semibold">{PAY_DEEPLINK_NOTICE}</p>
          {amountCopy.label ? (
            <p className="mt-1 text-mu-fg-3">{amountCopy.label}</p>
          ) : null}
        </div>
      ) : null}

      {settlement && transfers.length > 0 ? (
        <section
          aria-label="정산 공유"
          className="flex flex-col gap-2 rounded-mu-md bg-mu-bg p-3 text-mu-caption"
        >
          <p className="font-bold text-mu-fg">동행에게 공유하기</p>
          {shareBlockedMessage ? (
            <p className="font-semibold text-mu-warn">{shareBlockedMessage}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!shareText}
              className="min-h-tap rounded-mu-sm bg-mu-accent px-3 font-bold text-white disabled:opacity-40"
              onClick={() => void copyShareText()}
            >
              {textCopy.label ?? "문구 복사"}
            </button>
            {canNativeShare ? (
              <button
                type="button"
                disabled={!shareText}
                className="min-h-tap rounded-mu-sm border border-mu-accent px-3 font-bold text-mu-accent disabled:opacity-40"
                onClick={() => void nativeShare()}
              >
                공유하기
              </button>
            ) : null}
            {shareUrl ? (
              <button
                type="button"
                className="min-h-tap rounded-mu-sm border border-mu-accent px-3 font-bold text-mu-accent"
                onClick={() => void copyShareLink()}
              >
                {linkCopy.label ?? "링크 복사"}
              </button>
            ) : null}
          </div>
          {sharePath ? (
            <Link className="break-all text-mu-accent" href={sharePath}>
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

      {msg ? <p className="text-mu-caption text-mu-fg-3">{msg}</p> : null}

      <SettleExplainSheet
        open={explainOpen}
        onClose={() => setExplainOpen(false)}
        result={explainResult}
        stale={stale}
        tripCurrencies={tripCurrencies}
        reference={reference}
      />

      {canCreateSettlement ? (
        <BottomCTA
          label={settlement ? "정산 다시 계산하기" : "정산 계산하기"}
          onClick={() => void createSettlement()}
          hint={stale ? "지출이 바뀌었어요" : undefined}
        />
      ) : null}

      <footer className="flex flex-col gap-1 text-mu-caption leading-snug text-mu-fg-3">
        <p>
          정산은 원화 기준이에요. 외화 지출은 기록할 때의 환율로 바꾼 금액이고,
          송금은 각자 앱에서 직접 해 주세요.
        </p>
        {fxFallbackCount > 0 ? (
          <p
            role="alert"
            className="rounded-mu-sm bg-mu-warn/10 px-2 py-1 font-semibold text-mu-warn"
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
