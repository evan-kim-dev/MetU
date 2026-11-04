"use client";

import { Check, Pencil } from "lucide-react";
import { TripIconButton } from "@/components/trips/TripDetailParts";

type Props = {
  canEdit: boolean;
  memo?: string;
  editing: boolean;
  draftMemo: string;
  setDraftMemo: (v: string) => void;
  onOpenEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
};

export function TripDetailMemoSection({
  canEdit,
  memo,
  editing,
  draftMemo,
  setDraftMemo,
  onOpenEdit,
  onCancel,
  onSave,
}: Props) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-extrabold text-ink-heading">메모</h3>
        {canEdit && !editing ? (
          <TripIconButton label="메모 수정" onClick={onOpenEdit}>
            <Pencil className="h-4 w-4" strokeWidth={2.2} />
          </TripIconButton>
        ) : null}
      </div>

      {editing ? (
        <div className="flex flex-col gap-3">
          <textarea
            value={draftMemo}
            onChange={(e) => setDraftMemo(e.target.value)}
            rows={4}
            placeholder="여행 메모를 입력하세요"
            className="w-full resize-none rounded-2xl border border-brand bg-surface-white px-4 py-3 text-sm text-ink-heading focus:outline-none focus:ring-4 focus:ring-brand/10"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-xl border border-line-muted py-2.5 text-sm font-bold text-ink-body"
            >
              취소
            </button>
            <button
              type="button"
              onClick={onSave}
              className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-brand py-2.5 text-sm font-bold text-surface-white"
            >
              <Check className="h-4 w-4" />
              저장
            </button>
          </div>
        </div>
      ) : (
        <p className="rounded-2xl border border-line-soft bg-surface-white px-4 py-3 text-sm leading-relaxed text-ink-body">
          {memo?.trim()
            ? memo
            : canEdit
              ? "메모가 없어요. 연필 아이콘으로 추가하세요."
              : "메모가 없어요."}
        </p>
      )}
    </section>
  );
}
