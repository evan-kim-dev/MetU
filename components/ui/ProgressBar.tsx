interface ProgressBarProps {
  /** 현재 단계 (1부터 시작) */
  current: number;
  /** 전체 단계 수 */
  total: number;
}

/**
 * 온보딩 진행 게이지.
 * width 트랜지션으로 단계 변경 시 게이지가 부드럽게 차오른다.
 */
export function ProgressBar({ current, total }: ProgressBarProps) {
  const clamped = Math.min(Math.max(current, 0), total);
  const percent = Math.round((clamped / total) * 100);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-brand-strong">
          Step {clamped} / {total}
        </span>
        <span className="text-xs font-semibold text-ink-caption">
          {percent}%
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-surface-soft"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
