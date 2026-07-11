"use client";

import { useEffect, useState } from "react";
import { StepCard } from "@/components/ui/StepCard";
import { TextField } from "@/components/ui/TextField";
import { AIInsightBadge } from "@/components/ui/AIInsightBadge";
import {
  buildLocalBudgetInsight,
  parseBudgetAmount,
} from "@/lib/ai/budget-insight";

interface BudgetStepProps {
  value: string;
  onChange: (value: string) => void;
}

const QUICK_AMOUNTS = [
  { label: "100만원", amount: 1_000_000 },
  { label: "50만원", amount: 500_000 },
  { label: "10만원", amount: 100_000 },
  { label: "5만원", amount: 50_000 },
] as const;

/** 숫자만 남기고 3자리마다 콤마 포맷 */
function formatBudget(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("ko-KR");
}

export function BudgetStep({ value, onChange }: BudgetStepProps) {
  const current = parseBudgetAmount(value);
  const [insight, setInsight] = useState(() => buildLocalBudgetInsight(current));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 입력 중엔 로컬 인사이트를 먼저 보여주고, AI는 디바운스 후 호출
    setInsight(buildLocalBudgetInsight(current));

    if (current <= 0) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    const timer = window.setTimeout(() => {
      fetch(`/api/budget-insight?budget=${current}`, {
        signal: controller.signal,
        cache: "no-store",
      })
        .then(async (res) => {
          if (!res.ok) throw new Error("insight-failed");
          return (await res.json()) as { insight?: string };
        })
        .then((data) => {
          if (data.insight?.trim()) setInsight(data.insight.trim());
        })
        .catch((error) => {
          if ((error as Error)?.name === "AbortError") return;
          setInsight(buildLocalBudgetInsight(current));
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 450);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [current]);

  const addAmount = (amount: number) => {
    onChange(formatBudget(String(current + amount)));
  };

  return (
    <StepCard title="총 예산은 얼마인가요?">
      <TextField
        emphasized
        inputMode="numeric"
        placeholder="0"
        leading={<span className="text-2xl font-extrabold text-ink-caption">₩</span>}
        trailing="원"
        value={value}
        onChange={(e) => onChange(formatBudget(e.target.value))}
      />

      <div className="flex flex-col gap-2">
        {current > 0 && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => onChange("")}
              className="text-xs font-semibold text-brand active:opacity-70"
            >
              초기화
            </button>
          </div>
        )}
        <div className="grid grid-cols-4 gap-2">
          {QUICK_AMOUNTS.map((item) => (
            <button
              key={item.amount}
              type="button"
              onClick={() => addAmount(item.amount)}
              className="rounded-xl border border-line-muted bg-surface-white px-1 py-2.5 text-center text-xs font-bold text-ink-heading transition-all active:scale-97 active:border-brand active:bg-brand/5 active:text-brand"
            >
              +{item.label}
            </button>
          ))}
        </div>
      </div>

      <AIInsightBadge loading={loading}>{insight}</AIInsightBadge>
    </StepCard>
  );
}
