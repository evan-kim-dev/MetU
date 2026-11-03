"use client";

interface SelectChipProps {
  label: string;
  emoji?: string;
  selected: boolean;
  onToggle: () => void;
}

/**
 * 다중 선택 칩. 선택 시 accent 톤(그라디언트 없음).
 */
export function SelectChip({
  label,
  emoji,
  selected,
  onToggle,
}: SelectChipProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={[
        "mu-focus flex h-[88px] w-full flex-col items-center justify-center gap-1.5 rounded-mu-lg border p-4 text-center transition-colors active:scale-[0.98]",
        selected
          ? "border-mu-accent bg-mu-accent-soft text-mu-accent-strong ring-1 ring-mu-accent/20"
          : "border-mu-line bg-mu-card text-mu-fg-2 hover:bg-mu-sunken",
      ].join(" ")}
    >
      {emoji ? <span className="text-2xl leading-none">{emoji}</span> : null}
      <span className="text-mu-label font-bold leading-tight">{label}</span>
    </button>
  );
}
