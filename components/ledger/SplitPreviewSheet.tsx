"use client";

import { Loader2 } from "lucide-react";

import type {
  SplitPreviewBusy,
  SplitPreviewPayload,
} from "@/components/ledger/split-preview-types";
import { formatKRW } from "@/lib/shared/format";

const KIND_LABEL: Record<string, string> = {
  exclude: "일부 제외",
  only: "특정 멤버만",
  weights: "비율 조정",
  itemExclusions: "품목별 제외",
};

type Props = {
  preview: SplitPreviewPayload;
  busy?: SplitPreviewBusy;
  historyId?: string | null;
  error?: string;
  doneMsg?: string;
  clarify?: string;
  /** false 면 적용/되돌리기 버튼을 그리지 않아요(부모가 둠). */
  showActions?: boolean;
  onApply?: () => void;
  onUndo?: () => void;
  onClose?: () => void;
};

/**
 * 분담 미리보기·적용·되돌리기 UI (말로 고치기 / 멤버 칩 공통).
 */
export function SplitPreviewSheet({
  preview,
  busy = null,
  historyId = null,
  error = "",
  doneMsg = "",
  clarify,
  showActions = true,
  onApply,
  onUndo,
  onClose,
}: Props) {
  return (
    <div
      role="region"
      aria-label="분담 미리보기"
      className="rounded-lg bg-mu-card p-3 ring-1 ring-line"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-bold text-mu-fg">
          {preview.label || "지출"}
          {preview.kind
            ? ` · ${KIND_LABEL[preview.kind] ?? preview.kind}`
            : ""}
        </p>
        {onClose ? (
          <button
            type="button"
            className="min-h-[44px] shrink-0 px-2 text-xs font-bold text-mu-fg-3"
            onClick={onClose}
          >
            닫기
          </button>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-mu-fg-3">
        대상: {preview.label || "지출"}
        {typeof preview.krwAmount === "number"
          ? ` · ${formatKRW(preview.krwAmount)}`
          : ""}
      </p>
      {typeof preview.myBefore === "number" &&
      typeof preview.myAfter === "number" ? (
        <p className="mt-1 text-xs font-semibold text-mu-fg">
          내 부담 {formatKRW(preview.myBefore)} → {formatKRW(preview.myAfter)}
        </p>
      ) : null}
      <p className="mt-1 text-xs text-mu-fg-3">적용 전에 확인해 주세요</p>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="font-semibold text-mu-fg-3">지금</p>
          <ul className="mt-1 space-y-0.5">
            {preview.before.map((r) => (
              <li key={`b-${r.memberId}`}>
                {r.name} <span>{formatKRW(r.krw)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-semibold text-mu-accent">바꾼 뒤</p>
          <ul className="mt-1 space-y-0.5">
            {preview.after.map((r) => (
              <li key={`a-${r.memberId}`}>
                {r.name} <span>{formatKRW(r.krw)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {showActions ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {!historyId ? (
            <button
              type="button"
              disabled={Boolean(busy) || !onApply}
              className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-mu-accent px-3 text-xs font-bold text-mu-accent disabled:opacity-40"
              onClick={onApply}
            >
              {busy === "apply" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              적용하기
            </button>
          ) : (
            <button
              type="button"
              disabled={Boolean(busy) || !onUndo}
              className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-mu-warn px-3 text-xs font-bold text-mu-warn disabled:opacity-40"
              onClick={onUndo}
            >
              {busy === "undo" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              되돌리기
            </button>
          )}
        </div>
      ) : null}

      {clarify ? (
        <p className="mt-2 rounded-lg bg-mu-warn-soft px-2 py-2 text-xs font-semibold text-mu-warn">
          {clarify}
        </p>
      ) : null}
      {doneMsg ? (
        <p role="status" className="mt-2 text-xs font-semibold text-mu-ok">
          {doneMsg}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-xs font-semibold text-mu-err">
          {error}
        </p>
      ) : null}
    </div>
  );
}
