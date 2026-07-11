"use client";

import { useEffect, useState } from "react";
import { StepCard } from "@/components/ui/StepCard";
import { SelectChip } from "@/components/ui/SelectChip";
import { AIInsightBadge } from "@/components/ui/AIInsightBadge";
import { STYLE_LABELS } from "@/lib/trips/data";
import type { TravelStyle } from "./types";

interface StyleStepProps {
  selected: TravelStyle[];
  onToggle: (style: TravelStyle) => void;
}

interface StyleOption {
  value: TravelStyle;
  label: string;
  emoji: string;
}

const STYLE_OPTIONS: StyleOption[] = [
  { value: "healing", label: "힐링", emoji: "🌿" },
  { value: "sightseeing", label: "관광", emoji: "📸" },
  { value: "food", label: "맛집", emoji: "🍜" },
  { value: "shopping", label: "쇼핑", emoji: "🛍️" },
  { value: "activity", label: "액티비티", emoji: "🏄" },
  { value: "culture", label: "문화·예술", emoji: "🎨" },
  { value: "nature", label: "자연", emoji: "🏔️" },
  { value: "hotplace", label: "핫플", emoji: "🔥" },
];

function localInsight(styles: TravelStyle[]): string {
  if (styles.length === 0) return "";
  const labels = styles.map((s) => STYLE_LABELS[s] ?? s);
  return `선택하신 ${labels.join("·")} 스타일을 반영해 맞춤 코스를 짜드릴게요.`;
}

export function StyleStep({ selected, onToggle }: StyleStepProps) {
  const [insight, setInsight] = useState(() => localInsight(selected));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const local = localInsight(selected);
    setInsight(local);

    if (selected.length === 0) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    const timer = window.setTimeout(() => {
      fetch("/api/style-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ styles: selected }),
        signal: controller.signal,
        cache: "no-store",
      })
        .then(async (res) => {
          if (!res.ok) throw new Error("style-insight-failed");
          return (await res.json()) as { insight?: string };
        })
        .then((data) => {
          if (data.insight?.trim()) setInsight(data.insight.trim());
        })
        .catch((error) => {
          if ((error as Error)?.name === "AbortError") return;
          setInsight(local);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [selected]);

  return (
    <StepCard
      title="어떤 여행을 원하세요?"
      subtitle="관심 있는 스타일을 자유롭게 골라주세요. (복수 선택 가능)"
    >
      <div className="grid grid-cols-2 gap-3">
        {STYLE_OPTIONS.map((opt) => (
          <SelectChip
            key={opt.value}
            label={opt.label}
            emoji={opt.emoji}
            selected={selected.includes(opt.value)}
            onToggle={() => onToggle(opt.value)}
          />
        ))}
      </div>

      {selected.length > 0 ? (
        <AIInsightBadge loading={loading}>{insight}</AIInsightBadge>
      ) : null}
    </StepCard>
  );
}
