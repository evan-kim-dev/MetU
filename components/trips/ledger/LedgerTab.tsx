"use client";

import { Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { FxAttribution } from "@/components/fx/FxAttribution";
import { CurrencyTotals } from "@/components/ledger/CurrencyTotals";
import { ExpenseFxLine } from "@/components/trips/ledger/ExpenseFxLine";
import { MemberManager } from "@/components/trips/ledger/MemberManager";
import { TripInvitePanel } from "@/components/trips/ledger/TripInvitePanel";
import { totalsByCurrency } from "@/lib/ledger/stats";
import { ExpenseForm, type ExpenseDraft } from "@/components/trips/ledger/ExpenseForm";
import { NaturalExpenseInput } from "@/components/trips/ledger/NaturalExpenseInput";
import type { ExpenseParseItemOut } from "@/lib/ai/contracts";
import type { LedgerExpenseRow, TripMember } from "@/lib/ledger/types";
import { formatKRW } from "@/lib/shared/format";
import { TripIconButton } from "@/components/trips/TripDetailParts";

interface LedgerTabProps {
  readOnly?: boolean;
  /** 초대 링크를 만들 여행 id. canInvite 와 함께 주면 초대 패널이 보여요. */
  tripId?: string;
  /** 여행 소유자만 true. 합류한 동행자에게는 초대 버튼을 보여주지 않아요. */
  canInvite?: boolean;
  loading?: boolean;
  error?: string;
  members: TripMember[];
  expenses: LedgerExpenseRow[];
  totalKrw: number;
  defaultCurrency: string;
  placeOptions: Array<{ id: string; title: string; dayIndex?: number }>;
  meId?: string;
  settlement: {
    balances: Record<string, number>;
    transfers: Array<{ from: string; to: string; krw: number }>;
  };
  onAddMember?: (name: string) => Promise<boolean>;
  onRemoveMember?: (id: string) => Promise<boolean>;
  onSaveExpense?: (
    draft: ExpenseDraft,
    expenseId?: string,
    parseMeta?: ExpenseParseItemOut
  ) => Promise<boolean>;
  onDeleteExpense?: (id: string) => Promise<boolean>;
}

export function LedgerTab({
  readOnly,
  tripId,
  canInvite,
  loading,
  error,
  members,
  expenses,
  totalKrw,
  defaultCurrency,
  placeOptions,
  meId,
  settlement,
  onAddMember,
  onRemoveMember,
  onSaveExpense,
  onDeleteExpense,
}: LedgerTabProps) {
  const [mode, setMode] = useState<"list" | "manual" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const memberName = useMemo(() => {
    const map = new Map(members.map((m) => [m.id, m.displayName]));
    return (id: string) => map.get(id) ?? "?";
  }, [members]);

  const currencyTotals = useMemo(() => totalsByCurrency(expenses), [expenses]);
  const hasForeign = useMemo(
    () => expenses.some((e) => e.currency.trim().toUpperCase() !== "KRW"),
    [expenses]
  );

  if (loading) {
    return (
      <div className="h-40 animate-pulse rounded-2xl bg-surface-soft" aria-busy="true" />
    );
  }

  async function submitDraft(
    draft: ExpenseDraft,
    expenseId?: string,
    parseMeta?: ExpenseParseItemOut
  ) {
    if (!onSaveExpense) return;
    const ok = await onSaveExpense(draft, expenseId, parseMeta);
    if (ok) {
      setMode(null);
      setEditingId(null);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border-0 bg-surface-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Wallet className="h-5 w-5 text-brand" />
        <h3 className="text-lg font-extrabold text-ink-heading">함께 쓰는 가계부</h3>
      </div>

      {error ? (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">
          {error}
        </p>
      ) : null}

      <MemberManager
        members={members}
        readOnly={readOnly}
        onAdd={onAddMember}
        onRemove={onRemoveMember}
      />

      {tripId && !readOnly ? (
        <TripInvitePanel
          tripId={tripId}
          members={members}
          canInvite={Boolean(canInvite)}
        />
      ) : null}

      <div className="rounded-xl bg-surface-soft px-3 py-2">
        <p className="text-xs text-ink-caption">총 지출 (원화)</p>
        <p className="text-xl font-extrabold text-ink-heading">{formatKRW(totalKrw)}</p>
      </div>
      <CurrencyTotals
        totals={currencyTotals}
        totalKrw={totalKrw}
        className="rounded-xl border border-line-soft px-3 py-2"
      />

      {!readOnly && meId ? (
        <>
          <NaturalExpenseInput
            members={members}
            meId={meId}
            defaultCurrency={defaultCurrency}
            places={placeOptions}
            onConfirm={async (draft, meta) => {
              await submitDraft(draft, undefined, meta);
            }}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setMode(mode === "manual" ? null : "manual");
                setEditingId(null);
              }}
              className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-3 py-1.5 text-xs font-bold text-brand"
            >
              <Plus className="h-3.5 w-3.5" />
              직접 입력
            </button>
          </div>
          {mode === "manual" ? (
            <ExpenseForm
              members={members}
              defaultCurrency={defaultCurrency}
              places={placeOptions}
              onCancel={() => setMode(null)}
              onSubmit={(draft) => submitDraft(draft)}
            />
          ) : null}
        </>
      ) : null}

      <div className="flex flex-col gap-2">
        {expenses.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line-muted px-4 py-6 text-center text-sm text-ink-caption">
            아직 등록된 지출이 없어요
          </p>
        ) : (
          expenses.map((exp) =>
            !readOnly && editingId === exp.id ? (
              <ExpenseForm
                key={exp.id}
                members={members}
                defaultCurrency={defaultCurrency}
                places={placeOptions}
                initial={{
                  label: exp.label,
                  category: exp.category,
                  amount: String(exp.amount),
                  currency: exp.currency,
                  paidBy: exp.paidBy,
                  placeId: exp.placeId ?? "",
                  spentOn: exp.spentOn ?? "",
                  dayIndex:
                    exp.dayIndex != null ? String(exp.dayIndex) : "",
                }}
                onCancel={() => setEditingId(null)}
                onSubmit={(draft) => submitDraft(draft, exp.id)}
              />
            ) : (
              <div
                key={exp.id}
                className="flex flex-col rounded-2xl border border-line-soft bg-surface-white px-3 py-3"
              >
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink-heading">
                    {exp.label}
                  </p>
                  <p className="text-xs text-ink-caption">
                    {exp.category} · {memberName(exp.paidBy)} 결제
                    {exp.spentOn ? ` · ${exp.spentOn}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-extrabold text-ink-heading">
                  {formatKRW(exp.krwAmount)}
                </span>
                {!readOnly ? (
                  <>
                    <TripIconButton
                      label={`${exp.label} 수정`}
                      onClick={() => {
                        setEditingId(exp.id);
                        setMode(null);
                      }}
                    >
                      <Pencil className="h-4 w-4" strokeWidth={2.2} />
                    </TripIconButton>
                    {onDeleteExpense ? (
                      <TripIconButton
                        label={`${exp.label} 삭제`}
                        onClick={() => void onDeleteExpense(exp.id)}
                      >
                        <Trash2 className="h-4 w-4 text-danger" strokeWidth={2.2} />
                      </TripIconButton>
                    ) : null}
                  </>
                ) : null}
              </div>
              <ExpenseFxLine expense={exp} />
              </div>
            )
          )
        )}
        {hasForeign ? <FxAttribution /> : null}
      </div>

      {members.length > 0 && settlement.transfers.length > 0 ? (
        <div className="border-t border-line-soft pt-4">
          <p className="mb-2 text-sm font-extrabold text-ink-heading">정산 제안</p>
          <ul className="flex flex-col gap-1.5 text-sm text-ink-body">
            {settlement.transfers.map((t, i) => (
              <li key={`${t.from}-${t.to}-${i}`}>
                {memberName(t.from)} → {memberName(t.to)}{" "}
                <span className="font-bold text-brand">{formatKRW(t.krw)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
