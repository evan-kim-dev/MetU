"use client";

import { Loader2 } from "lucide-react";
import { useId, useState } from "react";

import { SplitPreviewSheet } from "@/components/ledger/SplitPreviewSheet";
import type { SplitPreviewPayload } from "@/components/ledger/split-preview-types";
import {
  SPLIT_PATCH_TEXT_MAX,
  type SplitPatch,
} from "@/lib/ledger/split-patch";
import { formatKRW } from "@/lib/shared/format";

type BatchItem = {
  patch: SplitPatch;
  preview: SplitPreviewPayload;
  idempotencyKey: string;
  historyId: string | null;
};

type Props = {
  tripId: string;
  onChanged?: () => void | Promise<void>;
};

function newKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * 한 줄로 여러 지출 분담 바꾸기 (K7c). 적용은 기존 apply/undo API 를 건별로.
 */
export function SplitBatchBox({ tripId, onChanged }: Props) {
  const textFieldId = useId();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"preview" | "apply" | "undo" | null>(null);
  const [error, setError] = useState("");
  const [clarify, setClarify] = useState("");
  const [items, setItems] = useState<BatchItem[]>([]);
  const [doneMsg, setDoneMsg] = useState("");
  const [appliedCount, setAppliedCount] = useState(0);

  function resetPreview() {
    setItems([]);
    setClarify("");
    setError("");
    setDoneMsg("");
    setAppliedCount(0);
  }

  async function onPreview() {
    const trimmed = text.trim();
    if (!trimmed) {
      setError("무엇을 바꿀지 적어 주세요.");
      return;
    }
    setBusy("preview");
    setError("");
    setClarify("");
    setDoneMsg("");
    setAppliedCount(0);
    try {
      const res = await fetch("/api/ledger/split-patch/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId, text: trimmed }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        needsClarification?: boolean;
        clarification?: string | null;
        message?: string;
        error?: string;
        items?: Array<{ patch: SplitPatch; preview: SplitPreviewPayload }>;
      };
      if (res.status === 422 && json.error === "guest-self-only") {
        setError(json.message ?? "다른 사람의 분담은 호스트만 바꿀 수 있어요.");
        setItems([]);
        return;
      }
      if (!res.ok) {
        setError("미리보기를 만들지 못했어요. 잠시 후 다시 시도해 주세요.");
        setItems([]);
        return;
      }
      if (json.needsClarification || !json.items?.length) {
        setClarify(
          json.clarification ??
            "요청을 이해하지 못했어요. 조금 더 자세히 적어 주세요."
        );
        setItems([]);
        return;
      }
      setItems(
        json.items.map((it) => ({
          ...it,
          idempotencyKey: newKey(),
          historyId: null,
        }))
      );
    } catch {
      setError("네트워크 오류가 났어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(null);
    }
  }

  async function applyAll() {
    if (items.length === 0) return;
    setBusy("apply");
    setError("");
    setDoneMsg("");
    let done = 0;
    const next = [...items];
    for (let i = 0; i < next.length; i++) {
      const it = next[i]!;
      if (it.historyId) {
        done += 1;
        continue;
      }
      try {
        const res = await fetch("/api/ledger/split-patch/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patch: it.patch,
            beforeDigest: it.preview.beforeDigest,
            idempotencyKey: it.idempotencyKey,
          }),
        });
        const json = (await res.json()) as {
          ok?: boolean;
          historyId?: string;
          message?: string;
          error?: string;
        };
        if (!res.ok || !json.historyId) {
          setError(
            json.message ??
              `${next.length}건 중 ${done}건 적용됐어요. 나머지는 실패했어요.`
          );
          setItems(next);
          setAppliedCount(done);
          setBusy(null);
          await onChanged?.();
          return;
        }
        next[i] = { ...it, historyId: json.historyId };
        done += 1;
      } catch {
        setError(
          `${next.length}건 중 ${done}건 적용됐어요. 나머지는 실패했어요.`
        );
        setItems(next);
        setAppliedCount(done);
        setBusy(null);
        await onChanged?.();
        return;
      }
    }
    setItems(next);
    setAppliedCount(done);
    setDoneMsg(`${done}건을 적용했어요.`);
    setBusy(null);
    await onChanged?.();
  }

  async function undoAll() {
    const withHistory = items.filter((it) => it.historyId);
    if (withHistory.length === 0) return;
    setBusy("undo");
    setError("");
    for (const it of [...withHistory].reverse()) {
      try {
        await fetch(`/api/ledger/split-patch/${it.historyId}/undo`, {
          method: "POST",
        });
      } catch {
        /* continue */
      }
    }
    setItems((prev) => prev.map((it) => ({ ...it, historyId: null })));
    setAppliedCount(0);
    setDoneMsg("모두 되돌렸어요.");
    setBusy(null);
    await onChanged?.();
  }

  return (
    <section
      aria-label="한 줄로 분담 바꾸기"
      className="rounded-2xl bg-mu-card p-4 shadow-sm"
    >
      <h2 className="text-sm font-extrabold text-mu-fg">
        한 줄로 분담 바꾸기
      </h2>
      <label htmlFor={textFieldId} className="sr-only">
        분담 수정 요청
      </label>
      <textarea
        id={textFieldId}
        value={text}
        maxLength={SPLIT_PATCH_TEXT_MAX}
        placeholder="민수랑 나는 술 빼줘"
        className="mt-2 min-h-[88px] w-full rounded-xl border border-mu-line bg-mu-sunken px-3 py-2 text-sm"
        onChange={(e) => setText(e.target.value)}
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy !== null}
          className="inline-flex min-h-[44px] items-center gap-1 rounded-lg bg-mu-accent px-3 text-xs font-bold text-white disabled:opacity-40"
          onClick={() => void onPreview()}
        >
          {busy === "preview" ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : null}
          미리보기
        </button>
        {items.length > 0 ? (
          <button
            type="button"
            className="min-h-[44px] rounded-lg border border-mu-line-strong px-3 text-xs font-bold text-mu-fg-3"
            onClick={resetPreview}
          >
            지우기
          </button>
        ) : null}
      </div>

      {clarify ? (
        <p role="status" className="mt-2 text-xs font-semibold text-mu-warn">
          {clarify}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-xs font-semibold text-mu-err">
          {error}
        </p>
      ) : null}
      {doneMsg ? (
        <p role="status" className="mt-2 text-xs font-semibold text-mu-ok">
          {doneMsg}
        </p>
      ) : null}

      {items.length > 0 ? (
        <div className="mt-3 flex flex-col gap-3">
          {items.map((it) => {
            const beforeSum = it.preview.before.reduce((s, r) => s + r.krw, 0);
            const afterSum = it.preview.after.reduce((s, r) => s + r.krw, 0);
            return (
              <div key={it.preview.expenseId + it.idempotencyKey}>
                <SplitPreviewSheet
                  preview={it.preview}
                  busy={busy}
                  historyId={it.historyId}
                  showActions={false}
                />
                <p className="mt-1 text-xs text-mu-fg-3">
                  합계 {formatKRW(beforeSum)} → {formatKRW(afterSum)}
                  {beforeSum === afterSum ? " (불변)" : ""}
                  {it.historyId ? " · 적용됨" : ""}
                </p>
              </div>
            );
          })}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy !== null || appliedCount === items.length}
              className="min-h-[44px] rounded-lg bg-mu-accent px-3 text-xs font-bold text-white disabled:opacity-40"
              onClick={() => void applyAll()}
            >
              {busy === "apply" ? "적용 중…" : "모두 확정"}
            </button>
            <button
              type="button"
              disabled={busy !== null || appliedCount === 0}
              className="min-h-[44px] rounded-lg border border-mu-warn px-3 text-xs font-bold text-mu-warn disabled:opacity-40"
              onClick={() => void undoAll()}
            >
              {busy === "undo" ? "되돌리는 중…" : "모두 되돌리기"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
