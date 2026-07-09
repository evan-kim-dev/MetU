interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** 섹션 제목 + (선택) 우측 액션 텍스트 버튼. */
export function SectionHeader({
  title,
  actionLabel,
  onAction,
}: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-lg font-extrabold text-ink-heading">{title}</h3>
      {actionLabel && (
        <button
          type="button"
          onClick={onAction}
          className="text-sm font-semibold text-brand"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
