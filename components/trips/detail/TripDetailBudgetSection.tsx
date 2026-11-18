"use client";

import { Check, Pencil, Wallet } from "lucide-react";
import { useMemo } from "react";
import { BudgetDonutChart } from "@/components/recommend/BudgetDonutChart";
import { TripIconButton } from "@/components/trips/TripDetailParts";
import {
  budgetOverageCopy,
  deriveBudgetView,
  planEstimateKrw,
} from "@/lib/ledger/plan-estimate";
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
  /** 초과 시 일정 탭으로 (암묵 변경 없음) */
  onReviewSchedule?: () => void;
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
  onReviewSchedule,
}: Props) {
  const planKrw = useMemo(() => planEstimateKrw(trip), [trip]);
  const view = useMemo(
    () =>
      deriveBudgetView({
        budget: trip.budget,
        spent: trip.spent,
        planKrw,
      }),
    [trip.budget, trip.spent, planKrw]
  );
  const overage = budgetOverageCopy(view);

  return (
    <section className="rounded-mu-xl border border-mu-line bg-mu-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-mu-accent" aria-hidden />
          <h3 className="text-mu-heading text-mu-fg">예산 한도</h3>
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
            <span className="text-mu-caption font-semibold text-mu-fg-3">
              예산 한도 (원)
            </span>
            <input
              inputMode="numeric"
              value={draftBudget}
              onChange={(e) =>
                setDraftBudget(e.target.value.replace(/[^0-9]/g, ""))
              }
              className="mu-focus h-11 rounded-mu-md border border-mu-accent bg-mu-card px-3 text-mu-body font-bold text-mu-fg"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="mu-focus min-h-tap flex-1 rounded-mu-md border border-mu-line py-2.5 text-mu-body font-bold text-mu-fg-2"
            >
              취소
            </button>
            <button
              type="button"
              onClick={onSave}
              className="mu-focus flex min-h-tap flex-1 items-center justify-center gap-1 rounded-mu-md bg-mu-accent py-2.5 text-mu-body font-bold text-mu-on-accent"
            >
              <Check className="h-4 w-4" aria-hidden />
              저장
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-mu-caption font-medium text-mu-fg-3">
                  남은 한도
                </p>
                <p className="mu-num text-2xl font-extrabold text-mu-fg">
                  {formatKRW(remaining)}
                </p>
              </div>
              <p className="text-mu-body font-semibold text-mu-accent">
                {usedPercent}% 사용
              </p>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-mu-sunken">
              <div
                className="h-full rounded-full bg-mu-accent"
                style={{ width: `${Math.min(usedPercent, 100)}%` }}
              />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-mu-caption">
              <div className="rounded-mu-md bg-mu-sunken px-3 py-2">
                <dt className="font-medium text-mu-fg-3">예산 한도</dt>
                <dd className="mu-num mt-0.5 font-bold text-mu-fg">
                  {formatKRW(trip.budget)}
                </dd>
              </div>
              <div className="rounded-mu-md bg-mu-sunken px-3 py-2">
                <dt className="font-medium text-mu-fg-3">실제 지출</dt>
                <dd className="mu-num mt-0.5 font-bold text-mu-fg">
                  {formatKRW(trip.spent)}
                </dd>
              </div>
              {planKrw != null ? (
                <div className="col-span-2 rounded-mu-md bg-mu-sunken px-3 py-2">
                  <dt className="font-medium text-mu-fg-3">예상 지출 (플랜)</dt>
                  <dd className="mu-num mt-0.5 font-bold text-mu-fg">
                    {formatKRW(planKrw)}
                  </dd>
                  <p className="mt-1 text-mu-caption leading-snug text-mu-fg-3">
                    일정·배분 기준 추정이에요. 실제 지출로 자동 올리지 않아요.
                  </p>
                </div>
              ) : null}
            </dl>
            {overage ? (
              <div
                role="status"
                className="mt-3 rounded-mu-md border border-mu-warn/30 bg-mu-warn-soft px-3 py-3 text-mu-caption font-semibold text-mu-warn"
              >
                <p>{overage}</p>
                {onReviewSchedule ? (
                  <button
                    type="button"
                    className="mu-focus mt-2 min-h-tap font-bold text-mu-accent underline"
                    onClick={onReviewSchedule}
                  >
                    일정 확인하기
                  </button>
                ) : null}
              </div>
            ) : (
              <p className="mt-2 text-mu-caption leading-relaxed text-mu-fg-3">
                실제 지출은 확인·확정된 가계부 합이에요. 예상(플랜)과는 따로
                봐요.
              </p>
            )}
          </div>

          {trip.budgetAllocation && trip.budgetAllocation.length > 0 ? (
            <div className="border-t border-mu-line pt-5">
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
