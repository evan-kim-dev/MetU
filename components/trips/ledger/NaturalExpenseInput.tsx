"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";
import type { ExpenseParseItemOut } from "@/lib/ai/contracts";
import type { TripMember } from "@/lib/ledger/types";
import { ExpenseForm, type ExpenseDraft } from "@/components/trips/ledger/ExpenseForm";

interface NaturalExpenseInputProps {
  members: TripMember[];
  meId: string;
  defaultCurrency: string;
  places: Array<{ id: string; title: string; dayIndex?: number }>;
  onConfirm: (draft: ExpenseDraft, meta: ExpenseParseItemOut) => Promise<void>;
}

export function NaturalExpenseInput({
  members,
  meId,
  defaultCurrency,
  places,
  onConfirm,
}: NaturalExpenseInputProps) {
  const [text, setText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{
    item: ExpenseParseItemOut;
    draft: ExpenseDraft;
  } | null>(null);

  async function handleParse() {
    const trimmed = text.trim();
    if (!trimmed || parsing) return;
    setParsing(true);
    setError("");
    setPreview(null);

    try {
      const res = await fetch("/api/ledger/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: trimmed,
          members: members.map((m) => ({
            id: m.id,
            displayName: m.displayName,
          })),
          places: places.map((p) => ({ id: p.id, title: p.title })),
          defaultCurrency,
          meId,
          today: new Date().toISOString().slice(0, 10),
        }),
      });
      const data = (await res.json()) as {
        items?: ExpenseParseItemOut[];
        needsClarification?: string | null;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "분석에 실패했어요.");
        return;
      }
      if (data.needsClarification) {
        setError(data.needsClarification);
        return;
      }
      const item = data.items?.[0];
      if (!item) {
        setError("지출을 찾지 못했어요. 다시 입력해 주세요.");
        return;
      }
      const place = item.placeId
        ? places.find((p) => p.id === item.placeId)
        : undefined;
      setPreview({
        item,
        draft: {
          label: item.label,
          category: item.category,
          amount: String(item.amount),
          currency: item.currency,
          paidBy: item.paidByMemberId ?? meId,
          placeId: item.placeId ?? "",
          spentOn: item.spentOn ?? "",
          dayIndex: place?.dayIndex != null ? String(place.dayIndex) : "",
        },
      });
    } catch {
      setError("네트워크 오류가 났어요.");
    } finally {
      setParsing(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line-soft bg-surface-white p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-brand" />
        <p className="text-sm font-extrabold text-ink-heading">자연어로 지출 입력</p>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="예: 어제 저녁 라멘 9800엔 내가 냈어, 우리 셋이 나눠"
        className="w-full resize-none rounded-xl border border-line-muted bg-surface-soft/50 px-3 py-2 text-sm text-ink-heading focus:border-brand focus:outline-none"
      />
      <button
        type="button"
        disabled={parsing || !text.trim()}
        onClick={() => void handleParse()}
        className="rounded-xl bg-brand py-2.5 text-sm font-bold text-surface-white disabled:opacity-50"
      >
        {parsing ? "분석 중…" : "AI로 해석하기"}
      </button>
      {error ? (
        <p className="text-xs font-semibold text-danger">{error}</p>
      ) : null}
      {preview ? (
        <div className="flex flex-col gap-2 border-t border-line-soft pt-3">
          <p className="text-xs font-semibold text-ink-caption">
            확인 후 저장해 주세요 (자동 저장되지 않아요)
          </p>
          <ExpenseForm
            members={members}
            defaultCurrency={defaultCurrency}
            places={places}
            initial={preview.draft}
            submitLabel="확인 후 저장"
            onCancel={() => setPreview(null)}
            onSubmit={async (draft) => {
              await onConfirm(draft, preview.item);
              setPreview(null);
              setText("");
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
