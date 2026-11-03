"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  JP_TAX_REFUND_DISCLAIMER,
  JP_TAX_REFUND_SOURCE_URL,
  JP_TAX_REFUND_VERIFIED_ON,
  groupStoreDays,
} from "@/lib/ledger/jp-tax-refund";
import { listExpenses } from "@/lib/ledger/supabase";
import type { LedgerExpenseRow } from "@/lib/ledger/types";
import { getBrowserSupabase } from "@/lib/supabase/browser";

const STATUS_LABEL: Record<string, string> = {
  eligible: "대상 가능",
  below_threshold: "금액 부족",
  needs_amount: "세별도 금액 필요",
  legacy: "구제도(대상 아님)",
  consumable_warning: "소모품 주의",
};

export default function TaxFreeWalletPage() {
  const { id: tripId } = useParams<{ id: string }>();
  const [expenses, setExpenses] = useState<LedgerExpenseRow[]>([]);
  const [localCurrency, setLocalCurrency] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    const [ex, trip] = await Promise.all([
      listExpenses(supabase, tripId),
      supabase
        .from("trips")
        .select("local_currency")
        .eq("id", tripId)
        .maybeSingle(),
    ]);
    setExpenses(ex);
    setLocalCurrency(
      (trip.data as { local_currency?: string } | null)?.local_currency ?? null
    );
    setLoaded(true);
  }, [tripId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const isJapan = (localCurrency ?? "").toUpperCase() === "JPY";
  const groups = useMemo(
    () =>
      groupStoreDays(
        expenses.map((e) => ({
          id: e.id,
          merchant: e.merchant,
          label: e.label,
          placeId: e.placeId,
          spentOn: e.spentOn,
          currency: e.currency,
          amount: e.amount,
          category: e.category,
          taxFree: e.taxFree,
          taxExclAmount: e.taxExclAmount,
        }))
      ),
    [expenses]
  );

  if (!loaded) {
    return <p className="p-6 text-sm text-ink-muted">불러오는 중…</p>;
  }

  if (!isJapan) {
    return (
      <div className="mx-auto max-w-lg px-4 py-6">
        <Link href={`/trips/${tripId}/ledger`} className="text-xs font-bold text-brand">
          ← 가계부
        </Link>
        <p className="mt-4 text-sm text-ink-muted">
          일본 여행(현지 통화 JPY)일 때만 면세 지갑을 보여 드려요.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6 pb-28">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">면세 지갑</h1>
        <Link href={`/trips/${tripId}/ledger`} className="text-xs font-bold text-brand">
          가계부
        </Link>
      </div>

      <p className="mt-2 text-xs text-ink-muted">{JP_TAX_REFUND_DISCLAIMER}</p>
      <p className="mt-1 text-[11px] text-ink-muted">
        출처:{" "}
        <a
          href={JP_TAX_REFUND_SOURCE_URL}
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          일본 세관 면세 안내
        </a>{" "}
        (확인일 {JP_TAX_REFUND_VERIFIED_ON})
      </p>

      <section className="mt-6 rounded-2xl bg-surface-soft p-4 text-xs">
        <h2 className="font-extrabold text-ink-heading">출국 전 체크리스트</h2>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-ink-body">
          <li>여권 지참</li>
          <li>면세 수속 단말/키오스크 또는 Visit Japan Web 사전 설정</li>
          <li>면세품 휴대 (포장 개봉·소비 주의)</li>
          <li>Red 결과면 세관 검사 구역으로 물품 지참</li>
        </ul>
      </section>

      <p className="mt-4 text-[11px] text-ink-muted">
        동행자가 올린 영수증은 본인만 볼 수 있어요.
      </p>

      <section className="mt-6">
        <h2 className="text-sm font-extrabold text-ink-heading">
          JPY 지출 · 면세 표시
        </h2>
        <ul className="mt-2 flex flex-col gap-2">
          {expenses
            .filter((e) => e.currency.toUpperCase() === "JPY")
            .map((e) => (
              <li
                key={e.id}
                className="flex flex-col gap-2 rounded-xl bg-surface-soft px-3 py-2 text-xs"
              >
                <div className="flex min-h-[44px] items-center justify-between gap-2">
                  <span className="font-bold text-ink-heading">
                    {e.merchant || e.label}
                  </span>
                  <label className="flex min-h-[44px] items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(e.taxFree)}
                      onChange={(ev) => {
                        void (async () => {
                          const supabase = getBrowserSupabase();
                          if (!supabase) return;
                          await supabase
                            .from("trip_expenses")
                            .update({ tax_free: ev.target.checked })
                            .eq("id", e.id);
                          await reload();
                        })();
                      }}
                    />
                    면세
                  </label>
                </div>
                {e.taxFree ? (
                  <label className="flex items-center gap-2">
                    세별도(엔)
                    <input
                      type="number"
                      inputMode="decimal"
                      className="min-h-[44px] w-28 rounded-lg border border-line-soft px-2"
                      defaultValue={e.taxExclAmount ?? ""}
                      onBlur={(ev) => {
                        const n = Number(ev.target.value);
                        void (async () => {
                          const supabase = getBrowserSupabase();
                          if (!supabase) return;
                          await supabase
                            .from("trip_expenses")
                            .update({
                              tax_excl_amount:
                                Number.isFinite(n) && n > 0 ? n : null,
                            })
                            .eq("id", e.id);
                          await reload();
                        })();
                      }}
                    />
                  </label>
                ) : null}
                {e.hasReceipt ? (
                  <span className="text-ink-muted">영수증 있음</span>
                ) : null}
              </li>
            ))}
        </ul>
      </section>

      <ul className="mt-4 flex flex-col gap-3">
        {groups.length === 0 ? (
          <li className="text-sm text-ink-muted">
            위에 면세 표시를 켜면 점포×날짜 카드가 생겨요.
          </li>
        ) : (
          groups.map((g) => (
            <li
              key={g.key}
              className="rounded-2xl border border-line-soft bg-surface-white p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-extrabold text-ink-heading">{g.storeLabel}</p>
                  <p className="text-xs text-ink-muted">{g.spentOn}</p>
                </div>
                <span className="rounded-full bg-surface-soft px-2 py-1 text-[11px] font-bold">
                  {STATUS_LABEL[g.status] ?? g.status}
                </span>
              </div>
              {g.taxExclSum != null ? (
                <p className="mt-2 text-sm">
                  세별도 합계 {g.taxExclSum.toLocaleString("ja-JP")}엔
                </p>
              ) : null}
              {g.shortfall != null ? (
                <p className="mt-1 text-xs text-amber-800">
                  {g.shortfall.toLocaleString("ja-JP")}엔 더 있으면 기준에
                  닿아요
                </p>
              ) : null}
              <p className="mt-2 text-[11px] text-ink-muted">
                수속 기한 약 {g.deadlineApprox} · 정확한 기한은 공식 안내 확인
              </p>
              {g.status === "legacy" ? (
                <p className="mt-1 text-[11px] text-ink-muted">
                  2026-10-31 이전 구매는 구제도예요. 이 화면 대상이 아니에요.
                </p>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
