import Link from "next/link";

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  /** AI 섹션 강조 (액센트 바) */
  ai?: boolean;
  rightSlot?: React.ReactNode;
}

/** 섹션 제목 + (선택) 우측 액션. */
export function SectionHeader({
  title,
  actionLabel,
  onAction,
  actionHref,
  ai = false,
  rightSlot,
}: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        {ai ? (
          <span
            className="h-4 w-1 shrink-0 rounded-full bg-mu-accent"
            aria-hidden
          />
        ) : null}
        <h3
          className={[
            "truncate text-mu-heading font-extrabold",
            ai ? "text-mu-accent" : "text-mu-fg",
          ].join(" ")}
        >
          {title}
        </h3>
      </div>
      {rightSlot ??
        (actionLabel && actionHref ? (
          <Link
            href={actionHref}
            className="mu-focus shrink-0 text-mu-label font-semibold text-mu-accent transition-opacity hover:opacity-80"
          >
            {actionLabel}
          </Link>
        ) : actionLabel ? (
          <button
            type="button"
            onClick={onAction}
            className="mu-focus shrink-0 text-mu-label font-semibold text-mu-accent transition-opacity hover:opacity-80"
          >
            {actionLabel}
          </button>
        ) : null)}
    </div>
  );
}
