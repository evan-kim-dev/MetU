"use client";

import { StepCard } from "@/components/ui/StepCard";
import { SelectChip } from "@/components/ui/SelectChip";
import { AIInsightBadge } from "@/components/ui/AIInsightBadge";
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

export function StyleStep({ selected, onToggle }: StyleStepProps) {
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

      {selected.length > 0 && (
        <AIInsightBadge>
          선택하신 {selected.length}개 스타일을 반영해 맞춤 코스를 짜드릴게요.
        </AIInsightBadge>
      )}
    </StepCard>
  );
}
