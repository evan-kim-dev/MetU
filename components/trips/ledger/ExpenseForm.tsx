"use client";

import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { TripMember } from "@/lib/ledger/types";
import { formatKRW } from "@/lib/shared/format";

export type ExpenseDraft = {
  label: string;
  category: string;
  amount: string;
  currency: string;
  paidBy: string;
  placeId: string;
  spentOn: string;
  dayIndex: string;
};

const CATEGORIES = ["식비", "교통", "숙소", "관광", "쇼핑", "기타"] as const;

interface ExpenseFormProps {
  members: TripMember[];
  defaultCurrency: string;
  places: Array<{ id: string; title: string; dayIndex?: number }>;
  initial?: Partial<ExpenseDraft>;
  submitLabel?: string;
  onCancel: () => void;
  onSubmit: (draft: ExpenseDraft) => void | Promise<void>;
}

export function ExpenseForm({
  members,
  defaultCurrency,
  places,
  initial,
  submitLabel = "저장",
  onCancel,
  onSubmit,
}: ExpenseFormProps) {
  const [draft, setDraft] = useState<ExpenseDraft>({
    label: initial?.label ?? "",
    category: initial?.category ?? "기타",
    amount: initial?.amount ?? "",
    currency: initial?.currency ?? defaultCurrency,
    paidBy: initial?.paidBy ?? members[0]?.id ?? "",
    placeId: initial?.placeId ?? "",
    spentOn: initial?.spentOn ?? "",
    dayIndex: initial?.dayIndex ?? "",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!draft.paidBy && members[0]) {
      setDraft((d) => ({ ...d, paidBy: members[0]!.id }));
    }
  }, [members, draft.paidBy]);

  // 여행지 통화가 늦게 해석되면 빈 통화만 채움 (USD 깜빡임 방지용).
  useEffect(() => {
    if (initial?.currency) return;
    if (!defaultCurrency) return;
    setDraft((d) => (d.currency ? d : { ...d, currency: defaultCurrency }));
  }, [defaultCurrency, initial?.currency]);

  async function handleSave() {
    if (busy) return;
    setBusy(true);
    await onSubmit(draft);
    setBusy(false);
  }

  const previewKrw = Number(draft.amount.replace(/[^0-9.]/g, "")) || 0;

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-brand/30 bg-brand/5 p-3">
      <input
        value={draft.label}
        onChange={(e) => setDraft({ ...draft, label: e.target.value })}
        placeholder="항목명"
        className="h-10 rounded-xl border border-line-muted bg-surface-white px-3 text-sm font-bold text-ink-heading focus:border-brand focus:outline-none"
      />
      <div className="grid grid-cols-2 gap-2">
        <select
          value={draft.category}
          onChange={(e) => setDraft({ ...draft, category: e.target.value })}
          className="h-10 rounded-xl border border-line-muted bg-surface-white px-2 text-sm text-ink-heading focus:border-brand focus:outline-none"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={draft.paidBy}
          onChange={(e) => setDraft({ ...draft, paidBy: e.target.value })}
          className="h-10 rounded-xl border border-line-muted bg-surface-white px-2 text-sm text-ink-heading focus:border-brand focus:outline-none"
        >
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.displayName} 결제
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <input
          inputMode="decimal"
          value={draft.amount}
          onChange={(e) =>
            setDraft({ ...draft, amount: e.target.value.replace(/[^0-9.]/g, "") })
          }
          placeholder="금액"
          className="col-span-2 h-10 rounded-xl border border-line-muted bg-surface-white px-3 text-sm font-bold text-ink-heading focus:border-brand focus:outline-none"
        />
        <input
          value={draft.currency}
          onChange={(e) =>
            setDraft({ ...draft, currency: e.target.value.toUpperCase().slice(0, 3) })
          }
          placeholder="KRW"
          className="h-10 rounded-xl border border-line-muted bg-surface-white px-2 text-sm font-bold text-ink-heading focus:border-brand focus:outline-none"
        />
      </div>
      {places.length > 0 ? (
        <select
          value={draft.placeId}
          onChange={(e) => {
            const id = e.target.value;
            const place = places.find((p) => p.id === id);
            setDraft({
              ...draft,
              placeId: id,
              dayIndex:
                place?.dayIndex != null ? String(place.dayIndex) : draft.dayIndex,
            });
          }}
          className="h-10 rounded-xl border border-line-muted bg-surface-white px-2 text-sm text-ink-heading focus:border-brand focus:outline-none"
        >
          <option value="">장소 (선택)</option>
          {places.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <input
          type="date"
          value={draft.spentOn}
          onChange={(e) => setDraft({ ...draft, spentOn: e.target.value })}
          className="h-10 rounded-xl border border-line-muted bg-surface-white px-2 text-sm text-ink-heading focus:border-brand focus:outline-none"
        />
        <input
          inputMode="numeric"
          value={draft.dayIndex}
          onChange={(e) =>
            setDraft({ ...draft, dayIndex: e.target.value.replace(/[^0-9]/g, "") })
          }
          placeholder="일차"
          className="h-10 rounded-xl border border-line-muted bg-surface-white px-3 text-sm text-ink-heading focus:border-brand focus:outline-none"
        />
      </div>
      {previewKrw > 0 ? (
        <p className="text-xs text-ink-caption">
          입력 금액 {formatKRW(Math.round(previewKrw))} (환율은 저장 시 적용)
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-line-muted py-2.5 text-sm font-bold text-ink-body"
        >
          <X className="h-4 w-4" />
          취소
        </button>
        <button
          type="button"
          disabled={busy || !draft.label.trim() || !draft.amount}
          onClick={() => void handleSave()}
          className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-brand py-2.5 text-sm font-bold text-surface-white disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          {busy ? "저장 중…" : submitLabel}
        </button>
      </div>
    </div>
  );
}
