import Link from "next/link";

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  /** AI 섹션 강조 (그라데이션 액센트) */
  ai?: boolean;
}

/** 섹션 제목 + (선택) 우측 액션 텍스트 버튼. */
export function SectionHeader({
  title,
  actionLabel,
  onAction,
  actionHref,
  ai = false,
}: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        {ai ? (
          <span className="h-4 w-1 shrink-0 rounded-full ai-gradient-bg" aria-hidden />
        ) : null}
        <h3
          className={[
            "truncate text-lg font-extrabold",
            ai ? "ai-gradient-text" : "text-ink-heading",
          ].join(" ")}
        >
          {title}
        </h3>
      </div>
      {actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="shrink-0 text-sm font-semibold text-brand transition-opacity hover:opacity-80"
        >
          {actionLabel}
        </Link>
      ) : actionLabel ? (
        <button
          type="button"
          onClick={onAction}
          className="shrink-0 text-sm font-semibold text-brand transition-opacity hover:opacity-80"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
