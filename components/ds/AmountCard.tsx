import { cn } from "@/lib/design/tokens";
import { formatKRW } from "@/lib/shared/format";

export type AmountCardProps = {
  label: string;
  amount: number;
  sub?: string;
  tone?: "neutral" | "ok" | "accent";
  action?: React.ReactNode;
  className?: string;
};

const TONE_AMOUNT: Record<NonNullable<AmountCardProps["tone"]>, string> = {
  neutral: "text-mu-fg",
  ok: "text-mu-ok",
  accent: "text-mu-accent",
};

export function AmountCard({
  label,
  amount,
  sub,
  tone = "neutral",
  action,
  className,
}: AmountCardProps) {
  const formatted = formatKRW(amount);
  return (
    <div
      className={cn(
        "rounded-mu-xl border border-mu-line bg-mu-card p-6",
        className
      )}
    >
      <p className="text-mu-label text-mu-fg-3">{label}</p>
      <p
        className={cn(
          "mu-num mt-2 text-mu-amount-xl",
          TONE_AMOUNT[tone]
        )}
        aria-label={`${label} ${formatted}`}
      >
        <span>{formatted}</span>
      </p>
      {sub ? (
        <p className="mt-2 text-mu-caption text-mu-fg-3">{sub}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
