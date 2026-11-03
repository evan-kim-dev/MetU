import { cn } from "@/lib/design/tokens";

export type ProgressRingProps = {
  value: number;
  max: number;
  size?: number;
  label?: string;
  className?: string;
};

export function ProgressRing({
  value,
  max,
  size = 96,
  label,
  className,
}: ProgressRingProps) {
  if (max <= 0) return null;

  const clamped = Math.max(0, Math.min(value, max));
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - clamped / max);
  const ariaLabel = label ?? `송금 ${clamped}건 중 ${max}건 완료`;

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={cn(
        "relative inline-flex items-center justify-center",
        className
      )}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--mu-sunken)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--mu-ok)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset var(--mu-dur-slow) var(--mu-ease)",
          }}
        />
      </svg>
      <span className="mu-num absolute text-mu-heading text-mu-fg">
        {clamped}/{max}
      </span>
    </div>
  );
}
