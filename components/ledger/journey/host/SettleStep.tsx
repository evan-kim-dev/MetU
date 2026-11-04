"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AmountCard } from "@/components/ds/AmountCard";
import { BottomCTA } from "@/components/ds/BottomCTA";
import { FxAttribution } from "@/components/fx/FxAttribution";
import { CurrencyTotals } from "@/components/ledger/CurrencyTotals";
import { FeeLeakCard } from "@/components/ledger/FeeLeakCard";
import { MyShareCard } from "@/components/ledger/MyShareCard";
import { SettleExplainSheet } from "@/components/ledger/SettleExplainSheet";
import {
  useSettleReference,
  type SettleReference,
} from "@/components/ledger/useSettleReference";
import { useAuth } from "@/lib/auth/AuthProvider";
import { explainSettlement } from "@/lib/ledger/explain";
import { resolveMyShare } from "@/lib/ledger/my-share";
import {
  basisHash,
  computeBalances,
  minimizeTransfers,
  type LedgerExpense,
} from "@/lib/ledger/settle";
import { totalsByCurrency } from "@/lib/ledger/stats";
import {
  fetchLatestSettlement,
  listExpenses,
  listMembers,
  listVoidedExpenseIds,
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
  /** journey 모드에서 송금 단계로 이동 */
  onPay?: () => void;
  /** settle URL 에서 PayStep 과 공유할 참고 환율 상태 */
  reference?: SettleReference;
};

/**
 * 호스트 ⑤ 정산 단계. 잔액·통화합계·수수료 차이 → 정산표 생성.
 * 송금·공유·이력은 PayStep(U5).
 */
export function SettleStep({
  tripId,
  mode = "page",
  onAdjust,
  onPay,
  reference: referenceProp,
}: Props) {
  const router = useRouter();
  const { user, isAnonymous } = useAuth();
  const [members, setMembers] = useState<TripMember[]>([]);
  const [creating, setCreating] = useState(false);
  const [expenseRows, setExpenseRows] = useState<LedgerExpenseRow[]>([]);
  const [fxFallbackCount, setFxFallbackCount] = useState(0);
  const [hasForeign, setHasForeign] = useState(false);
  const [expenseLabels, setExpenseLabels] = useState<Record<string, string>>({});
  const [tripCurrencies, setTripCurrencies] = useState<string[]>([]);
  const [explainOpen, setExplainOpen] = useState(false);
  const [settlement, setSettlement] = useState<SettlementSnapshot | null>(null);
  const [basisState, setBasisState] = useState<{
    source: LedgerExpense[];
    hash: string;
  } | null>(null);
  const [msg, setMsg] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const localReference = useSettleReference();
  const reference = referenceProp ?? localReference;

  const expenses = useMemo(
    () => expenseRows.map(toSettleExpense),
    [expenseRows]
  );

  const loadSettlement = useCallback(async () => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    const res = await fetchLatestSettlement(supabase, tripId);
    if (!res.ok) {
      setLoadError(true);
      return;
    }
    setSettlement(res.settlement);
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

  const me = useMemo(
    () =>
      user ? members.find((m) => m.userId && m.userId === user.id) : undefined,
    [members, user]
  );

  const basis =
    loaded && basisState && basisState.source === expenses
      ? basisState.hash
      : "";
  const transfers = useMemo(() => settlement?.transfers ?? [], [settlement]);

  const stale = Boolean(
    settlement &&
      (settlement.status === "stale" ||
        (basis && basis !== settlement.basisHash))
  );
  const hasPaid = transfers.some((t) => t.status === "paid");

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

  const payHref = `/trips/${tripId}/ledger?step=pay`;

  function goPay() {
    if (onPay) {
      onPay();
      return;
    }
    router.push(payHref);
  }

  async function createSettlement() {
    const supabase = getBrowserSupabase();
    if (!supabase || !user || creating) return;
    setCreating(true);
    setMsg("");
    try {
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
      setMsg("정산을 만들었어요.");
      await loadSettlement();
      goPay();
    } finally {
      setCreating(false);
    }
  }

  const isOwner = Boolean(me?.isOwner);
  const canCreateSettlement = isOwner && !isAnonymous;
  const totalKrw = expenses.reduce((s, e) => s + e.krwAmount, 0);
  const myBalance = me ? (balances[me.id] ?? 0) : null;
  const myShare = resolveMyShare({
    liveBalance: myBalance,
    hasSettlement: Boolean(settlement),
    stale,
  });

  /** 정산표가 있고 최신이면 송금 단계로 갈 수 있어요(송금 0건·completed 포함). */
  const canGoPay = Boolean(settlement) && !stale;

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
          ? "mx-auto flex max-w-lg flex-col gap-4 px-4 py-6 pb-8"
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
            멤버 잔액을 확인하고 정산표를 만들어요. 송금은 다음 단계에서 해요.
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
            ? "호스트가 정산을 계산해요. 송금은 송금 단계에서 표시할 수 있어요."
            : "정산표는 여행을 만든 분만 만들 수 있어요. 송금은 송금 단계에서 표시할 수 있어요."}
        </p>
      ) : null}

      {loaded && !settlement && canCreateSettlement ? (
        <p className="text-mu-caption text-mu-fg-3">
          아직 만든 정산표가 없어요. 아래 버튼으로 계산해 보세요.
        </p>
      ) : null}

      {loaded && canGoPay ? (
        <div className="rounded-mu-md border border-mu-line bg-mu-card px-3 py-2">
          <p className="text-mu-caption text-mu-fg-2">
            {transfers.length > 0
              ? "정산표가 있어요. 아래 버튼으로 송금 단계로 넘어가요."
              : "정산이 맞춰져 송금할 금액이 없어요. 송금 단계에서 현황을 확인할 수 있어요."}
          </p>
        </div>
      ) : null}

      {msg ? <p className="text-mu-caption text-mu-fg-3">{msg}</p> : null}

      <SettleExplainSheet
        open={explainOpen}
        onClose={() => setExplainOpen(false)}
        result={explainResult}
        stale={stale}
        tripCurrencies={tripCurrencies}
        reference={reference}
      />

      {canGoPay ? (
        <BottomCTA
          label="송금하러 가기"
          onClick={goPay}
          loading={creating}
          secondary={
            canCreateSettlement
              ? {
                  label: "정산 다시 계산하기",
                  onClick: () => void createSettlement(),
                }
              : undefined
          }
        />
      ) : canCreateSettlement ? (
        <BottomCTA
          label={settlement ? "정산 다시 계산하기" : "정산 계산하기"}
          onClick={() => void createSettlement()}
          loading={creating}
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
