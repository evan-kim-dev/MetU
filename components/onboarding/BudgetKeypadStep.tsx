"use client";

import { NumKeypad, SelectChip } from "@/components/ds";
import { parseBudgetAmount } from "@/lib/ai/budget-insight";
import { formatKRW } from "@/lib/shared/format";

export type BudgetKeypadStepProps = {
  value: string;
  onChange: (value: string) => void;
};

const QUICK = [
  { label: "+100만", amount: 1_000_000 },
  { label: "+50만", amount: 500_000 },
  { label: "+10만", amount: 100_000 },
] as const;

function digitsOnly(raw: string): string {
  return raw.replace(/[^0-9]/g, "");
}

function formatBudget(raw: string): string {
  const digits = digitsOnly(raw);
  if (!digits) return "";
  return Number(digits).toLocaleString("ko-KR");
}

export function BudgetKeypadStep({ value, onChange }: BudgetKeypadStepProps) {
  const current = parseBudgetAmount(value);

  const appendDigit = (digit: string) => {
    const next = digitsOnly(value) + digit;
    // 과도한 자리수 방지 (최대 9자리)
    if (next.length > 9) return;
    onChange(formatBudget(next));
  };

  const backspace = () => {
    const digits = digitsOnly(value).slice(0, -1);
    onChange(digits ? formatBudget(digits) : "");
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-mu-title font-bold text-mu-fg">총 예산을 알려 주세요</h2>
        <p className="text-mu-body text-mu-fg-2">
          키패드로 입력하거나 아래 칩으로 더할 수 있어요.
        </p>
      </div>

      <div className="rounded-mu-xl border border-mu-line bg-mu-card px-5 py-6 text-center">
        <p className="mu-num text-3xl font-bold tracking-tight text-mu-fg">
          {current > 0 ? formatKRW(current) : "₩0"}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {QUICK.map((q) => (
          <SelectChip
            key={q.label}
            label={q.label}
            onClick={() => onChange(formatBudget(String(current + q.amount)))}
          />
        ))}
        <SelectChip
          label="초기화"
          selected={current === 0}
          onClick={() => onChange("")}
        />
      </div>

      <NumKeypad onDigit={appendDigit} onBackspace={backspace} />
    </div>
  );
}
