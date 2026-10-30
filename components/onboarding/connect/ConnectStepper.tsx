"use client";

type Props = {
  index: number;
  total: number;
  label: string;
};

export function ConnectStepper({ index, total, label }: Props) {
  return (
    <div className="flex flex-col gap-2" aria-live="polite">
      <p className="text-sm font-semibold text-ink-heading">
        {index}/{total} 단계 · {label}
      </p>
      <div className="flex gap-1.5" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={[
              "h-1.5 flex-1 rounded-full",
              i < index ? "bg-brand" : "bg-line-muted",
            ].join(" ")}
          />
        ))}
      </div>
    </div>
  );
}
