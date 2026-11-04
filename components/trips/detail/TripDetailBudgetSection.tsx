"use client";

import { Check, Pencil, Wallet } from "lucide-react";
import { BudgetDonutChart } from "@/components/recommend/BudgetDonutChart";
import { TripIconButton } from "@/components/trips/TripDetailParts";
import { formatKRW } from "@/lib/shared/format";
import type { Trip } from "@/lib/trips/types";

type Props = {
  trip: Trip;
  canEdit: boolean;
  remaining: number;
  usedPercent: number;
  editing: boolean;
  draftBudget: string;
  setDraftBudget: (v: string) => void;
  onOpenEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
};

export function TripDetailBudgetSection({
  trip,
  canEdit,
  remaining,
  usedPercent,
  editing,
  draftBudget,
  setDraftBudget,
  onOpenEdit,
  onCancel,
  onSave,
}: Props) {
  return (
    <section className="rounded-2xl border-0 bg-surface-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-brand" />
          <h3 className="text-lg font-extrabold text-ink-heading">예산</h3>
        </div>
        {canEdit && !editing ? (
          <TripIconButton label="예산 수정" onClick={onOpenEdit}>
            <Pencil className="h-4 w-4" strokeWidth={2.2} />
          </TripIconButton>
        ) : null}
      </div>

      {editing ? (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-ink-caption">총 예산</span>
            <input
              inputMode="numeric"
              value={draftBudget}
              onChange={(e) =>
                setDraftBudget(e.target.value.replace(/[^0-9]/g, ""))
              }
              className="h-11 rounded-xl border border-brand bg-surface-white px-3 text-sm font-bold text-ink-heading focus:outline-none focus:ring-4 focus:ring-brand/10"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-xl border border-line-muted py-2.5 text-sm font-bold text-ink-body"
            >
              취소
            </button>
            <button
              type="button"
              onClick={onSave}
              className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-brand py-2.5 text-sm font-bold text-surface-white"
            >
              <Check className="h-4 w-4" />
              저장
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs font-medium text-ink-caption">남은 예산</p>
                <p className="text-2xl font-extrabold text-ink-heading">
                  {formatKRW(remaining)}
                </p>
              </div>
              <p className="text-sm font-semibold text-brand">{usedPercent}% 사용</p>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-soft">
              <div
                className="h-full rounded-full bg-brand"
                style={{ width: `${Math.min(usedPercent, 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-ink-caption">
              총 {formatKRW(trip.budget)} 중 {formatKRW(trip.spent)} 사용
            </p>
          </div>

          {trip.budgetAllocation && trip.budgetAllocation.length > 0 ? (
            <div className="border-t border-line-soft pt-5">
              <BudgetDonutChart
                items={trip.budgetAllocation}
                totalBudget={trip.budget}
                people={trip.people}
              />
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
