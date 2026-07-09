"use client";

import { useEffect, useState } from "react";
import { StepCard } from "@/components/ui/StepCard";
import { Counter } from "@/components/ui/Counter";
import { AIInsightBadge } from "@/components/ui/AIInsightBadge";
import {
  buildLocalPartyInsight,
  parseBudgetAmount,
} from "@/lib/ai/party-insight";

interface PartyStepProps {
  value: number;
  budget: string;
  onChange: (value: number) => void;
}

export function PartyStep({ value, budget, onChange }: PartyStepProps) {
  const totalBudget = parseBudgetAmount(budget);
  const perPerson = value > 0 ? Math.floor(totalBudget / value) : 0;
  const month = new Date().getMonth() + 1;

  const [insight, setInsight] = useState(() =>
    buildLocalPartyInsight(totalBudget, value, month)
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setInsight(buildLocalPartyInsight(totalBudget, value, month));

    if (totalBudget <= 0) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    const timer = window.setTimeout(() => {
      const qs = new URLSearchParams({
        budget: String(totalBudget),
        people: String(value),
        month: String(month),
      });

      fetch(`/api/party-insight?${qs.toString()}`, {
        signal: controller.signal,
        cache: "no-store",
      })
        .then(async (res) => {
          if (!res.ok) throw new Error("party-insight-failed");
          return (await res.json()) as { insight?: string };
        })
        .then((data) => {
          if (data.insight?.trim()) setInsight(data.insight.trim());
        })
        .catch((error) => {
          if ((error as Error)?.name === "AbortError") return;
          setInsight(buildLocalPartyInsight(totalBudget, value, month));
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 400);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [totalBudget, value, month]);

  return (
    <StepCard
      title="몇 명이 함께 떠나나요?"
      subtitle="총 예산을 인원으로 나누고, 시즌에 맞는 목적지도 알려드려요."
    >
      <Counter value={value} onChange={onChange} min={1} max={20} unit="명" />

      {totalBudget > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-line-soft bg-surface-white px-3 py-3">
            <p className="text-xs font-semibold text-ink-caption">총 예산</p>
            <p className="mt-1 text-sm font-extrabold text-ink-heading">
              ₩{totalBudget.toLocaleString("ko-KR")}
            </p>
          </div>
          <div className="rounded-xl border border-brand/20 bg-brand/5 px-3 py-3">
            <p className="text-xs font-semibold text-ink-caption">1인당</p>
            <p className="mt-1 text-sm font-extrabold text-brand">
              ₩{perPerson.toLocaleString("ko-KR")}
            </p>
          </div>
        </div>
      )}

      <AIInsightBadge>
        {loading ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
            {insight}
          </span>
        ) : (
          insight
        )}
      </AIInsightBadge>
    </StepCard>
  );
}
