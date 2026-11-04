"use client";

import { Pencil, Plus } from "lucide-react";
import {
  TripExpenseEditor,
  TripIconButton,
  type ExpenseFormState,
} from "@/components/trips/TripDetailParts";
import { formatKRW } from "@/lib/shared/format";
import type { TripExpense } from "@/lib/trips/types";

type Props = {
  expenses: TripExpense[];
  editSection: string | null;
  editingExpenseId: string | null;
  expenseForm: ExpenseFormState;
  setExpenseForm: (v: ExpenseFormState) => void;
  openExpenseAdd: () => void;
  openExpenseEdit: (expense: TripExpense) => void;
  saveExpense: () => void;
  deleteExpense: (id: string) => void;
  setEditSection: (v: "budget" | "expense" | "memo" | null) => void;
  setEditingExpenseId: (v: string | null) => void;
};

export function TripDetailGuestExpenses({
  expenses,
  editSection,
  editingExpenseId,
  expenseForm,
  setExpenseForm,
  openExpenseAdd,
  openExpenseEdit,
  saveExpense,
  deleteExpense,
  setEditSection,
  setEditingExpenseId,
}: Props) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-extrabold text-ink-heading">이전 방식 지출</h3>
        <button
          type="button"
          onClick={openExpenseAdd}
          className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-bold text-brand"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
          추가
        </button>
      </div>

      {editSection === "expense" && editingExpenseId === "new" ? (
        <TripExpenseEditor
          form={expenseForm}
          onChange={setExpenseForm}
          onCancel={() => {
            setEditSection(null);
            setEditingExpenseId(null);
          }}
          onSave={saveExpense}
        />
      ) : null}

      <div className="flex flex-col gap-2">
        {expenses.length === 0 && editSection !== "expense" ? (
          <p className="rounded-2xl border border-dashed border-line-muted px-4 py-6 text-center text-sm text-ink-caption">
            아직 지출 내역이 없어요
          </p>
        ) : null}

        {expenses.map((expense) =>
          editSection === "expense" && editingExpenseId === expense.id ? (
            <TripExpenseEditor
              key={expense.id}
              form={expenseForm}
              onChange={setExpenseForm}
              onCancel={() => {
                setEditSection(null);
                setEditingExpenseId(null);
              }}
              onSave={saveExpense}
              onDelete={() => deleteExpense(expense.id)}
            />
          ) : (
            <div
              key={expense.id}
              className="flex items-center gap-2 rounded-2xl border border-line-soft bg-surface-white px-3 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink-heading">
                  {expense.label}
                </p>
                <p className="text-xs text-ink-caption">
                  {expense.category} · {expense.date}
                </p>
              </div>
              <span className="shrink-0 text-sm font-extrabold text-ink-heading">
                {formatKRW(expense.amount)}
              </span>
              <TripIconButton
                label={`${expense.label} 수정`}
                onClick={() => openExpenseEdit(expense)}
              >
                <Pencil className="h-4 w-4" strokeWidth={2.2} />
              </TripIconButton>
            </div>
          )
        )}
      </div>
    </section>
  );
}
