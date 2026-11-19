"use client";

import { useMemo, useState } from "react";
import {
  BudgetSlimBar,
  SelectChip,
} from "@/components/ds";
import { parseBudgetAmount } from "@/lib/ai/budget-insight";
import { buildDisplayAllocation } from "@/lib/onboarding/display-allocation";
import type { OnboardingForm, TravelStyle } from "@/lib/onboarding/types";
import { formatKRW } from "@/lib/shared/format";

export type ConfirmPlanStepProps = {
  form: OnboardingForm;
  /** 한 줄 NL 힌트(목적지/메모). 비우면 칩·폴백 경로 사용 */
  freeText: string;
  onFreeTextChange: (value: string) => void;
  onChange: (patch: Partial<OnboardingForm>) => void;
};

const DEST_PRESETS = ["오사카", "도쿄", "후쿠오카", "방콕", "다낭", "제주"] as const;

const STYLE_OPTIONS: Array<{ value: TravelStyle; label: string }> = [
  { value: "healing", label: "힐링" },
  { value: "sightseeing", label: "관광" },
  { value: "food", label: "맛집" },
  { value: "shopping", label: "쇼핑" },
  { value: "activity", label: "액티비티" },
  { value: "culture", label: "문화" },
  { value: "nature", label: "자연" },
  { value: "hotplace", label: "핫플" },
];

function dateChipLabel(form: OnboardingForm): string {
  if (form.dateType === "specific" && form.startDate && form.endDate) {
    return `${form.startDate.replace(/-/g, ".")} ~ ${form.endDate.slice(5).replace(/-/g, ".")}`;
  }
  if (form.dateType === "flexible") {
    return `${form.flexibleYear}.${form.flexibleMonth} 예정`;
  }
  return "날짜 선택";
}

export function ConfirmPlanStep({
  form,
  freeText,
  onFreeTextChange,
  onChange,
}: ConfirmPlanStepProps) {
  const [panel, setPanel] = useState<
    null | "dest" | "date" | "people" | "style"
  >(null);

  const budget = parseBudgetAmount(form.budget);
  const segments = useMemo(() => buildDisplayAllocation(budget), [budget]);

  const destLabel = form.destination.trim() || "목적지 선택";
  const styleLabel =
    form.styles.length > 0
      ? form.styles
          .map((s) => STYLE_OPTIONS.find((o) => o.value === s)?.label ?? s)
          .join("·")
      : "스타일 선택";

  const toggleStyle = (style: TravelStyle) => {
    const next = form.styles.includes(style)
      ? form.styles.filter((s) => s !== style)
      : [...form.styles, style];
    onChange({ styles: next });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-mu-title font-bold text-mu-fg">
          좋아요! 이렇게 짜볼게요
        </h2>
        <p className="text-mu-body text-mu-fg-2">
          예산 안에서 일정을 잡아 드릴게요. 필요하면 아래를 고쳐 주세요.
        </p>
      </div>

      <section className="rounded-mu-xl border border-mu-line bg-mu-card p-5">
        <p className="text-mu-caption text-mu-fg-3">총 예산</p>
        <p className="mu-num mt-1 text-2xl font-bold text-mu-fg">
          {budget > 0 ? formatKRW(budget) : "₩0"}
        </p>
        <BudgetSlimBar
          className="mt-4"
          segments={segments.map((s) => ({
            id: s.id,
            label: s.label,
            percent: s.percent,
          }))}
        />
        <p className="mt-2 text-mu-caption text-mu-fg-3">
          분배는 미리보기예요. 확정 금액은 일정 생성 후 맞춰져요.
        </p>
      </section>

      <label className="flex flex-col gap-2">
        <span className="text-mu-label font-semibold text-mu-fg">
          한 줄로 알려 주세요 (선택)
        </span>
        <input
          type="text"
          value={freeText}
          onChange={(e) => onFreeTextChange(e.target.value)}
          placeholder="예: 오사카 3박, 맛집 위주로"
          className="mu-focus min-h-tap w-full rounded-mu-lg border border-mu-line bg-mu-card px-4 text-mu-body text-mu-fg placeholder:text-mu-fg-3"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <SelectChip
          label={destLabel}
          selected={Boolean(form.destination.trim())}
          onClick={() => setPanel(panel === "dest" ? null : "dest")}
        />
        <SelectChip
          label={dateChipLabel(form)}
          selected={
            form.dateType === "specific"
              ? Boolean(form.startDate && form.endDate)
              : form.dateType === "flexible"
          }
          onClick={() => setPanel(panel === "date" ? null : "date")}
        />
        <SelectChip
          label={`${form.people}명`}
          selected
          onClick={() => setPanel(panel === "people" ? null : "people")}
        />
        <SelectChip
          label={styleLabel}
          selected={form.styles.length > 0}
          onClick={() => setPanel(panel === "style" ? null : "style")}
        />
      </div>

      {panel === "dest" ? (
        <div className="rounded-mu-xl border border-mu-line bg-mu-card p-4">
          <p className="mb-3 text-mu-label font-semibold text-mu-fg">목적지</p>
          <div className="mb-3 flex flex-wrap gap-2">
            {DEST_PRESETS.map((d) => (
              <SelectChip
                key={d}
                label={d}
                selected={form.destination === d}
                onClick={() => {
                  onChange({ destination: d, origin: form.origin || "서울" });
                  setPanel(null);
                }}
              />
            ))}
          </div>
          <input
            type="text"
            value={form.destination}
            onChange={(e) =>
              onChange({
                destination: e.target.value,
                origin: form.origin || "서울",
              })
            }
            placeholder="직접 입력"
            className="mu-focus min-h-tap w-full rounded-mu-md border border-mu-line px-3 text-mu-body"
          />
        </div>
      ) : null}

      {panel === "date" ? (
        <div className="rounded-mu-xl border border-mu-line bg-mu-card p-4">
          <p className="mb-3 text-mu-label font-semibold text-mu-fg">일정</p>
          <div className="mb-3 flex gap-2">
            <SelectChip
              label="날짜 지정"
              selected={form.dateType === "specific"}
              onClick={() => onChange({ dateType: "specific" })}
            />
            <SelectChip
              label="언제든"
              selected={form.dateType === "flexible"}
              onClick={() =>
                onChange({
                  dateType: "flexible",
                  startDate: "",
                  endDate: "",
                })
              }
            />
          </div>
          {form.dateType === "specific" ? (
            <div className="flex flex-col gap-2">
              <label className="flex flex-col gap-1 text-mu-caption text-mu-fg-3">
                출발
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) =>
                    onChange({
                      startDate: e.target.value,
                      endDate:
                        form.endDate && form.endDate < e.target.value
                          ? ""
                          : form.endDate,
                    })
                  }
                  className="mu-focus min-h-tap rounded-mu-md border border-mu-line px-3 text-mu-body text-mu-fg"
                />
              </label>
              <label className="flex flex-col gap-1 text-mu-caption text-mu-fg-3">
                귀국
                <input
                  type="date"
                  value={form.endDate}
                  min={form.startDate || undefined}
                  onChange={(e) => onChange({ endDate: e.target.value })}
                  className="mu-focus min-h-tap rounded-mu-md border border-mu-line px-3 text-mu-body text-mu-fg"
                />
              </label>
            </div>
          ) : (
            <div className="flex gap-2">
              <label className="flex flex-1 flex-col gap-1 text-mu-caption text-mu-fg-3">
                연도
                <input
                  type="number"
                  value={form.flexibleYear}
                  onChange={(e) =>
                    onChange({ flexibleYear: Number(e.target.value) || form.flexibleYear })
                  }
                  className="mu-focus min-h-tap rounded-mu-md border border-mu-line px-3 text-mu-body"
                />
              </label>
              <label className="flex flex-1 flex-col gap-1 text-mu-caption text-mu-fg-3">
                월
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={form.flexibleMonth}
                  onChange={(e) =>
                    onChange({
                      flexibleMonth: Math.min(
                        12,
                        Math.max(1, Number(e.target.value) || 1)
                      ),
                    })
                  }
                  className="mu-focus min-h-tap rounded-mu-md border border-mu-line px-3 text-mu-body"
                />
              </label>
            </div>
          )}
        </div>
      ) : null}

      {panel === "people" ? (
        <div className="rounded-mu-xl border border-mu-line bg-mu-card p-4">
          <p className="mb-3 text-mu-label font-semibold text-mu-fg">인원</p>
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              className="mu-focus flex h-11 w-11 items-center justify-center rounded-mu-md border border-mu-line text-mu-title font-bold text-mu-fg"
              onClick={() =>
                onChange({ people: Math.max(1, form.people - 1) })
              }
              aria-label="인원 줄이기"
            >
              −
            </button>
            <span className="mu-num min-w-[3rem] text-center text-2xl font-bold text-mu-fg">
              {form.people}
            </span>
            <button
              type="button"
              className="mu-focus flex h-11 w-11 items-center justify-center rounded-mu-md border border-mu-line text-mu-title font-bold text-mu-fg"
              onClick={() =>
                onChange({ people: Math.min(20, form.people + 1) })
              }
              aria-label="인원 늘리기"
            >
              +
            </button>
          </div>
        </div>
      ) : null}

      {panel === "style" ? (
        <div className="rounded-mu-xl border border-mu-line bg-mu-card p-4">
          <p className="mb-3 text-mu-label font-semibold text-mu-fg">
            여행 스타일 (복수 선택)
          </p>
          <div className="flex flex-wrap gap-2">
            {STYLE_OPTIONS.map((opt) => (
              <SelectChip
                key={opt.value}
                label={opt.label}
                selected={form.styles.includes(opt.value)}
                onClick={() => toggleStyle(opt.value)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
