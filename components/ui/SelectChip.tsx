"use client";

interface SelectChipProps {
  label: string;
  emoji?: string;
  selected: boolean;
  onToggle: () => void;
}

/**
 * 다중 선택 칩 (여행 스타일 선택 등).
 * 선택 시 보더/배경/텍스트 컬러가 브랜드 톤으로 전환된다.
 */
export function SelectChip({ label, emoji, selected, onToggle }: SelectChipProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={[
        "flex h-[88px] w-full flex-col items-center justify-center gap-1.5 rounded-2xl border p-4 text-center transition-all active:scale-[0.98]",
        selected
          ? "border-brand bg-surface-soft text-brand-strong shadow-soft"
          : "border-line-soft bg-surface-white text-ink-body",
      ].join(" ")}
    >
      {emoji && <span className="text-2xl leading-none">{emoji}</span>}
      <span className="text-sm font-bold leading-tight">{label}</span>
    </button>
  );
}
