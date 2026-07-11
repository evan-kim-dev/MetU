"use client";

import { Check, Trash2, X } from "lucide-react";

export type ExpenseFormState = {
  label: string;
  category: string;
  amount: string;
  date: string;
};

interface TripExpenseEditorProps {
  form: ExpenseFormState;
  onChange: (next: ExpenseFormState) => void;
  onCancel: () => void;
  onSave: () => void;
  onDelete?: () => void;
}

export function TripExpenseEditor({
  form,
  onChange,
  onCancel,
  onSave,
  onDelete,
}: TripExpenseEditorProps) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-brand/30 bg-brand/5 p-3">
      <input
        value={form.label}
        onChange={(e) => onChange({ ...form, label: e.target.value })}
        placeholder="항목명 (예: 항공권)"
        className="h-10 rounded-xl border border-line-muted bg-surface-white px-3 text-sm font-bold text-ink-heading focus:border-brand focus:outline-none"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          value={form.category}
          onChange={(e) => onChange({ ...form, category: e.target.value })}
          placeholder="카테고리"
          className="h-10 rounded-xl border border-line-muted bg-surface-white px-3 text-sm text-ink-heading focus:border-brand focus:outline-none"
        />
        <input
          value={form.date}
          onChange={(e) => onChange({ ...form, date: e.target.value })}
          placeholder="날짜/메모"
          className="h-10 rounded-xl border border-line-muted bg-surface-white px-3 text-sm text-ink-heading focus:border-brand focus:outline-none"
        />
      </div>
      <input
        inputMode="numeric"
        value={form.amount}
        onChange={(e) =>
          onChange({ ...form, amount: e.target.value.replace(/[^0-9]/g, "") })
        }
        placeholder="금액"
        className="h-10 rounded-xl border border-line-muted bg-surface-white px-3 text-sm font-bold text-ink-heading focus:border-brand focus:outline-none"
      />
      <div className="flex gap-2">
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="rounded-xl border border-red-200 px-3 py-2.5 text-sm font-bold text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
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
          onClick={onSave}
          className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-brand py-2.5 text-sm font-bold text-surface-white"
        >
          <Check className="h-4 w-4" />
          저장
        </button>
      </div>
    </div>
  );
}

export function TripInfoCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-line-soft bg-surface-white p-4">
      <div className="mb-2 flex items-center gap-1.5 text-brand">
        {icon}
        <span className="text-xs font-semibold text-ink-caption">{label}</span>
      </div>
      <p className="text-base font-extrabold text-ink-heading">{value}</p>
    </div>
  );
}

export function TripIconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-caption transition-colors active:bg-surface-soft"
    >
      {children}
    </button>
  );
}
