"use client";

/** 섹션 하나만 실패했을 때 쓰는 안내. 전체 화면 에러 대신 이 줄과 다시 시도 버튼만 보여요. */
export function SectionRetry({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 text-sm text-ink-body"
    >
      <span className="min-w-0">불러오지 못했어요</span>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex min-h-tap shrink-0 items-center rounded-xl px-3 text-sm font-bold text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        다시 시도
      </button>
    </div>
  );
}
