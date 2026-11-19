"use client";

import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { BudgetSlimBar, Button, SelectChip } from "@/components/ds";
import { parseBudgetAmount } from "@/lib/ai/budget-insight";
import { buildDisplayAllocation } from "@/lib/onboarding/display-allocation";
import { PARSE_INTENT_TEXT_MAX } from "@/lib/onboarding/parse-intent";
import type { OnboardingForm, TravelStyle } from "@/lib/onboarding/types";
import { formatKRW } from "@/lib/shared/format";

export type ConfirmPlanStepProps = {
  form: OnboardingForm;
  /** AI 한 줄 입력. 채우기 후 아래 필드를 갱신해요 */
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

export function ConfirmPlanStep({
  form,
  freeText,
  onFreeTextChange,
  onChange,
}: ConfirmPlanStepProps) {
  const [parsing, setParsing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const budget = parseBudgetAmount(form.budget);
  const segments = useMemo(() => buildDisplayAllocation(budget), [budget]);

  const toggleStyle = (style: TravelStyle) => {
    const next = form.styles.includes(style)
      ? form.styles.filter((s) => s !== style)
      : [...form.styles, style];
    onChange({ styles: next });
  };

  const fillFromNl = async () => {
    const text = freeText.trim();
    if (!text || parsing) return;
    setParsing(true);
    setNotice(null);
    try {
      const res = await fetch("/api/onboarding/parse-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, form }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        form?: OnboardingForm;
        message?: string;
        error?: string;
      };
      if (!res.ok || !data.form) {
        setNotice("채우기에 실패했어요. 직접 골라 주세요.");
        return;
      }
      const { budget: _keep, ...rest } = data.form;
      onChange(rest);
      setNotice(data.message ?? "아래를 채워 두었어요.");
    } catch {
      setNotice("채우기에 실패했어요. 직접 골라 주세요.");
    } finally {
      setParsing(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-mu-title font-bold text-mu-fg">
          좋아요! 이렇게 짜볼게요
        </h2>
        <p className="text-mu-body text-mu-fg-2">
          예산 안에서 일정을 잡아 드릴게요. 한 줄로 말하면 아래를 채워 드려요.
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

      <div className="flex flex-col gap-2">
        <span className="text-mu-label font-semibold text-mu-fg">
          AI에게 한 줄로 말해 주세요
        </span>
        <div className="flex gap-2">
          <input
            type="text"
            value={freeText}
            onChange={(e) =>
              onFreeTextChange(e.target.value.slice(0, PARSE_INTENT_TEXT_MAX))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void fillFromNl();
              }
            }}
            placeholder="예: 오사카 3박 2인, 맛집 위주로"
            maxLength={PARSE_INTENT_TEXT_MAX}
            disabled={parsing}
            aria-label="여행 한 줄 입력"
            className="mu-focus min-h-tap min-w-0 flex-1 rounded-mu-lg border border-mu-line bg-mu-card px-4 text-mu-body text-mu-fg placeholder:text-mu-fg-3"
          />
          <Button
            type="button"
            variant="primary"
            size="md"
            className="shrink-0 rounded-mu-lg px-3"
            disabled={!freeText.trim() || parsing}
            loading={parsing}
            onClick={() => {
              void fillFromNl();
            }}
            aria-label="AI로 채우기"
          >
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" aria-hidden />
              채우기
            </span>
          </Button>
        </div>
        {notice ? (
          <p className="text-mu-caption text-mu-fg-2" role="status">
            {notice}
          </p>
        ) : (
          <p className="text-mu-caption text-mu-fg-3">
            Enter 또는 채우기를 누르면 아래 항목을 채워 드려요.
          </p>
        )}
      </div>

      <section className="flex flex-col gap-3">
        <h3 className="text-mu-label font-semibold text-mu-fg">목적지</h3>
        <div className="flex flex-wrap gap-2">
          {DEST_PRESETS.map((d) => (
            <SelectChip
              key={d}
              label={d}
              selected={form.destination === d}
              onClick={() => {
                onChange({ destination: d, origin: form.origin || "서울" });
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
          className="mu-focus min-h-tap w-full rounded-mu-lg border border-mu-line bg-mu-card px-4 text-mu-body text-mu-fg placeholder:text-mu-fg-3"
        />
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-mu-label font-semibold text-mu-fg">일정</h3>
        <div className="flex flex-wrap gap-2">
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
          <SelectChip
            label="날짜 지정"
            selected={form.dateType === "specific"}
            onClick={() => onChange({ dateType: "specific" })}
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
                className="mu-focus min-h-tap rounded-mu-md border border-mu-line bg-mu-card px-3 text-mu-body text-mu-fg"
              />
            </label>
            <label className="flex flex-col gap-1 text-mu-caption text-mu-fg-3">
              귀국
              <input
                type="date"
                value={form.endDate}
                min={form.startDate || undefined}
                onChange={(e) => onChange({ endDate: e.target.value })}
                className="mu-focus min-h-tap rounded-mu-md border border-mu-line bg-mu-card px-3 text-mu-body text-mu-fg"
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
                  onChange({
                    flexibleYear: Number(e.target.value) || form.flexibleYear,
                  })
                }
                className="mu-focus min-h-tap rounded-mu-md border border-mu-line bg-mu-card px-3 text-mu-body text-mu-fg"
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
                className="mu-focus min-h-tap rounded-mu-md border border-mu-line bg-mu-card px-3 text-mu-body text-mu-fg"
              />
            </label>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-mu-label font-semibold text-mu-fg">인원</h3>
        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            className="mu-focus flex h-11 w-11 items-center justify-center rounded-mu-md border border-mu-line bg-mu-card text-mu-title font-bold text-mu-fg"
            onClick={() => onChange({ people: Math.max(1, form.people - 1) })}
            aria-label="인원 줄이기"
          >
            −
          </button>
          <span className="mu-num min-w-[3rem] text-center text-2xl font-bold text-mu-fg">
            {form.people}
          </span>
          <button
            type="button"
            className="mu-focus flex h-11 w-11 items-center justify-center rounded-mu-md border border-mu-line bg-mu-card text-mu-title font-bold text-mu-fg"
            onClick={() => onChange({ people: Math.min(20, form.people + 1) })}
            aria-label="인원 늘리기"
          >
            +
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-mu-label font-semibold text-mu-fg">
          여행 스타일 (복수 선택)
        </h3>
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
      </section>
    </div>
  );
}
