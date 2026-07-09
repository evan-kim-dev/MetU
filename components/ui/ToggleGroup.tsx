"use client";

export interface ToggleOption<T extends string> {
  value: T;
  label: string;
}

interface ToggleGroupProps<T extends string> {
  options: ToggleOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

/**
 * 세그먼트형 토글 버튼 그룹 (날짜 타입 선택 등).
 */
export function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
}: ToggleGroupProps<T>) {
  return (
    <div className="flex gap-2 rounded-2xl bg-surface-soft p-1">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={[
              "flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition-all",
              active
                ? "bg-surface-white text-brand shadow-soft"
                : "text-ink-caption",
            ].join(" ")}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
