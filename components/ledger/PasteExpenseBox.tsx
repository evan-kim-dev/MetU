"use client";

import { ClipboardPaste, Loader2 } from "lucide-react";
import { useState } from "react";
import type { ExpenseDraftInput } from "@/lib/ledger/draft";

type Props = {
  tripId: string;
  onDrafts: (drafts: ExpenseDraftInput[]) => void;
  onCancelNotice?: (draft: ExpenseDraftInput) => void;
};

export function PasteExpenseBox({ tripId, onDrafts, onCancelNotice }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function parse(raw: string) {
    const value = raw.trim();
    if (!value) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/ledger/parse-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId, text: value, source: "sms" }),
      });
      if (!res.ok) {
        setError(
          res.status === 401
            ? "로그인이 필요해요."
            : "문자 분석에 실패했어요."
        );
        return;
      }
      const data = (await res.json()) as {
        drafts?: ExpenseDraftInput[];
      };
      const drafts = data.drafts ?? [];
      const cancels = drafts.filter((d) => d.kind === "cancel");
      const approvals = drafts.filter((d) => d.kind !== "cancel");
      for (const c of cancels) onCancelNotice?.(c);
      if (approvals.length) onDrafts(approvals);
      else if (!cancels.length) setError("지출로 읽을 내용이 없어요.");
      else setText("");
      if (approvals.length) setText("");
    } catch {
      setError("네트워크 오류예요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-surface-soft p-3">
      <p className="text-xs font-bold text-ink-heading">카드 문자 / 푸시 붙여넣기</p>
      <textarea
        className="min-h-[96px] w-full resize-y rounded-lg border border-line bg-surface-white px-3 py-2 text-sm"
        placeholder="승인 문자를 붙여 넣으세요"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={2000}
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
          onClick={() => void parse(text)}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          분석하기
        </button>
        <button
          type="button"
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-lg bg-surface-white px-3 py-2 text-xs font-bold text-ink-body ring-1 ring-line"
          onClick={async () => {
            try {
              const clip = await navigator.clipboard.readText();
              setText(clip);
              await parse(clip);
            } catch {
              setError("클립보드를 읽지 못했어요. 직접 붙여 넣어 주세요.");
            }
          }}
        >
          <ClipboardPaste className="h-3.5 w-3.5" />
          클립보드에서
        </button>
      </div>
      {error ? (
        <p className="text-xs font-semibold text-danger">{error}</p>
      ) : null}
    </div>
  );
}
