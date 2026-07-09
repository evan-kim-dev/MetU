import { formatKRW } from "@/lib/mock/home";
import type { BudgetAllocation } from "@/lib/ai/types";

interface BudgetDonutChartProps {
  items: BudgetAllocation[];
  totalBudget: number;
  people: number;
}

/** SVG 없이 CSS conic-gradient로 도넛 차트 */
export function BudgetDonutChart({
  items,
  totalBudget,
  people,
}: BudgetDonutChartProps) {
  let cursor = 0;
  const stops = items
    .map((item) => {
      const start = cursor;
      cursor += item.percent;
      return `${item.color} ${start}% ${cursor}%`;
    })
    .join(", ");

  const gradient =
    stops.length > 0
      ? `conic-gradient(from -90deg, ${stops})`
      : "conic-gradient(#E5E7EB 0% 100%)";

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative h-44 w-44">
        <div
          className="h-full w-full rounded-full shadow-soft"
          style={{ background: gradient }}
          aria-hidden
        />
        {/* 도넛 구멍 */}
        <div className="absolute inset-[22%] flex flex-col items-center justify-center overflow-hidden rounded-full bg-surface-white px-1.5 text-center shadow-sm">
          <p className="text-[9px] font-semibold leading-none text-ink-caption">
            총 예산
          </p>
          <p className="mt-1 max-w-full truncate text-[11px] font-extrabold leading-tight tracking-tight text-ink-heading">
            {formatKRW(totalBudget)}
          </p>
          <p className="mt-0.5 text-[9px] font-medium leading-none text-ink-caption">
            {people}인
          </p>
        </div>
      </div>

      <ul className="flex w-full flex-col gap-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between text-sm">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="truncate font-medium text-ink-body">
                {item.label}
              </span>
              <span className="text-xs font-semibold text-ink-caption">
                {item.percent}%
              </span>
            </div>
            <span className="shrink-0 font-bold text-ink-heading">
              {formatKRW(item.amount)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
