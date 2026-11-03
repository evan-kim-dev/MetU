"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useId, useState } from "react";

import { SplitPreviewSheet } from "@/components/ledger/SplitPreviewSheet";
import type { SplitPreviewPayload } from "@/components/ledger/split-preview-types";
import {
  SPLIT_PATCH_TEXT_MAX,
  type SplitPatch,
} from "@/lib/ledger/split-patch";
import {
  listExpenses,
  listVoidedExpenseIds,
} from "@/lib/ledger/supabase";
import { formatKRW } from "@/lib/shared/format";
import { getBrowserSupabase } from "@/lib/supabase/browser";

type PreviewPayload = SplitPreviewPayload;

type ExpenseOption = { id: string; label: string; krwAmount: number };

type Props = {
  tripId: string;
  /** 적용·되돌리기 성공 후 정산/잔액을 다시 읽게 한다. */
  onChanged?: () => void | Promise<void>;
};

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * 정산 화면용 자연어 분담 수정 (K7).
 * 미리보기 → 확인(적용) → 되돌리기. 음성 입력은 쓰지 않는다.
 */
export function SplitPatchBox({ tripId, onChanged }: Props) {
  const expenseFieldId = useId();
  const textFieldId = useId();
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ExpenseOption[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState("");
  const [expenseId, setExpenseId] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"preview" | "apply" | "undo" | null>(null);
  const [error, setError] = useState("");
  const [clarify, setClarify] = useState("");
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [patch, setPatch] = useState<SplitPatch | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [doneMsg, setDoneMsg] = useState("");

  const loadOptions = useCallback(async () => {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setListError("연결을 확인한 뒤 다시 열어 주세요.");
      return;
    }
    setLoadingList(true);
    setListError("");
    try {
      const [rows, voided] = await Promise.all([
        listExpenses(supabase, tripId),
        listVoidedExpenseIds(supabase, tripId),
      ]);
      if (voided === null) {
        setListError("지출 목록을 불러오지 못했어요.");
        return;
      }
      const next = rows
        .filter((r) => !voided.has(r.id))
        .map((r) => ({
          id: r.id,
          label: (r.merchant || r.label || "지출").trim() || "지출",
          krwAmount: r.krwAmount,
        }));
      setOptions(next);
      setExpenseId((prev) =>
        prev && next.some((o) => o.id === prev) ? prev : (next[0]?.id ?? "")
      );
    } finally {
      setLoadingList(false);
    }
  }, [tripId]);

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && options.length === 0) {
      await loadOptions();
    }
  }

  function clearPreviewState() {
    setPreview(null);
    setPatch(null);
    setIdempotencyKey("");
    setClarify("");
  }

  async function runPreview() {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy("preview");
    setError("");
    setClarify("");
    setPreview(null);
    setPatch(null);
    setHistoryId(null);
    setDoneMsg("");
    try {
      const payload: Record<string, string> = { text: trimmed, tripId };
      if (expenseId) payload.expenseId = expenseId;
      const res = await fetch("/api/ledger/split-patch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        needsClarification?: boolean;
        message?: string;
        patch?: SplitPatch;
        preview?: PreviewPayload;
        target?: { expenseId: string; label: string };
        error?: string;
      };
      if (!res.ok) {
        setError(
          data.message ??
            (data.error === "guest-self-only"
              ? "다른 사람의 분담은 호스트만 바꿀 수 있어요."
              : res.status === 401
                ? "로그인이 필요해요."
                : res.status === 429
                  ? "오늘은 AI 사용 한도를 다 썼어요. 내일 다시 시도해 주세요."
                  : res.status === 503
                    ? "AI를 잠시 쓸 수 없어요. 잠시 후 다시 시도해 주세요."
                    : "미리보기에 실패했어요. 다시 시도해 주세요.")
        );
        return;
      }
      if (data.target?.expenseId) {
        setExpenseId(data.target.expenseId);
      }
      if (data.needsClarification) {
        setClarify(data.message ?? "요청을 정확히 이해하지 못했어요.");
        return;
      }
      if (!data.preview || !data.patch) {
        setError("미리보기 결과가 비어 있어요.");
        return;
      }
      setPreview(data.preview);
      setPatch(data.patch);
      setIdempotencyKey(newIdempotencyKey());
    } catch {
      setError("네트워크 오류예요. 연결을 확인해 주세요.");
    } finally {
      setBusy(null);
    }
  }

  async function runApply() {
    if (!preview || !patch || !idempotencyKey || busy) return;
    setBusy("apply");
    setError("");
    try {
      const res = await fetch("/api/ledger/split-patch/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patch,
          beforeDigest: preview.beforeDigest,
          idempotencyKey,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        historyId?: string | null;
        already?: boolean;
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        const conflict = data.error === "conflict" || res.status === 409;
        setError(
          data.message ??
            (conflict
              ? "그 사이 분담이 바뀌었어요. 다시 미리보기를 확인해 주세요."
              : "적용에 실패했어요. 다시 시도해 주세요.")
        );
        if (conflict) clearPreviewState();
        return;
      }
      setHistoryId(data.historyId ?? null);
      setDoneMsg(
        data.already
          ? "이미 적용된 요청이에요."
          : "분담을 바꿨어요. 정산이 바뀌면 다시 계산해 주세요."
      );
      clearPreviewState();
      setText("");
      await onChanged?.();
      void loadOptions();
    } catch {
      setError("네트워크 오류예요. 연결을 확인해 주세요.");
    } finally {
      setBusy(null);
    }
  }

  async function runUndo() {
    if (!historyId || busy) return;
    setBusy("undo");
    setError("");
    try {
      const res = await fetch(`/api/ledger/split-patch/${historyId}/undo`, {
        method: "POST",
      });
      const data = (await res.json()) as {
        ok?: boolean;
        already?: boolean;
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        setError(
          data.message ??
            (data.error === "conflict"
              ? "적용한 뒤에 분담이 또 바뀌어서 되돌릴 수 없어요."
              : "되돌리기에 실패했어요.")
        );
        return;
      }
      setDoneMsg(
        data.already ? "이미 되돌린 변경이에요." : "원래대로 되돌렸어요."
      );
      setHistoryId(null);
      await onChanged?.();
      void loadOptions();
    } catch {
      setError("네트워크 오류예요. 연결을 확인해 주세요.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section
      aria-label="분담 말로 고치기"
      className="rounded-xl bg-mu-sunken p-3 text-xs"
    >
      <button
        type="button"
        className="flex min-h-[44px] w-full items-center justify-between gap-2 text-left font-bold text-mu-fg"
        aria-expanded={open}
        onClick={() => void toggleOpen()}
      >
        말로 분담 바꾸기
      </button>

      {open ? (
        <div className="mt-3 flex flex-col gap-2 border-t border-mu-line pt-3">
          <p className="font-normal text-mu-fg-3">
            예: &ldquo;저는 술 안 마셨어요&rdquo;, &ldquo;민수는 빼고&rdquo;
          </p>

          {loadingList ? (
            <p className="flex items-center gap-1 text-mu-fg-3">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              지출 목록을 불러오는 중…
            </p>
          ) : null}
          {listError ? (
            <p role="alert" className="font-semibold text-mu-err">
              {listError}
            </p>
          ) : null}

          {options.length === 0 && !loadingList ? (
            <p className="text-mu-fg-3">고칠 지출이 아직 없어요.</p>
          ) : (
            <>
              <label
                htmlFor={expenseFieldId}
                className="flex flex-col gap-1 font-bold"
              >
                지출 고르기
                <select
                  id={expenseFieldId}
                  className="min-h-[44px] w-full rounded-lg border border-mu-line bg-mu-card px-3 text-sm font-normal"
                  value={expenseId}
                  disabled={Boolean(busy)}
                  onChange={(e) => {
                    setExpenseId(e.target.value);
                    clearPreviewState();
                    setError("");
                    setDoneMsg("");
                    setHistoryId(null);
                  }}
                >
                  {options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label} · {formatKRW(o.krwAmount)}
                    </option>
                  ))}
                </select>
              </label>

              <label
                htmlFor={textFieldId}
                className="flex flex-col gap-1 font-bold"
              >
                어떻게 바꿀까요?
                <textarea
                  id={textFieldId}
                  className="min-h-[88px] w-full resize-y rounded-lg border border-mu-line bg-mu-card px-3 py-2 text-sm font-normal"
                  placeholder="저는 술 안 마셨어요"
                  value={text}
                  maxLength={SPLIT_PATCH_TEXT_MAX}
                  disabled={Boolean(busy) || Boolean(historyId)}
                  onChange={(e) => {
                    setText(e.target.value);
                    if (preview || clarify) {
                      clearPreviewState();
                      setError("");
                    }
                  }}
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={
                    Boolean(busy) || !text.trim() || Boolean(historyId)
                  }
                  className="inline-flex min-h-[44px] items-center gap-1 rounded-lg bg-mu-accent px-3 text-xs font-bold text-white disabled:opacity-40"
                  onClick={() => void runPreview()}
                >
                  {busy === "preview" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  미리보기
                </button>
                {preview ? (
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-mu-accent px-3 text-xs font-bold text-mu-accent disabled:opacity-40"
                    onClick={() => void runApply()}
                  >
                    {busy === "apply" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    적용하기
                  </button>
                ) : null}
                {historyId ? (
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-mu-warn px-3 text-xs font-bold text-mu-warn disabled:opacity-40"
                    onClick={() => void runUndo()}
                  >
                    {busy === "undo" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    되돌리기
                  </button>
                ) : null}
              </div>
            </>
          )}

          {clarify ? (
            <p className="rounded-lg bg-mu-warn-soft px-2 py-2 font-semibold text-mu-warn">
              {clarify}
            </p>
          ) : null}

          {preview ? (
            <SplitPreviewSheet preview={preview} showActions={false} />
          ) : null}

          {doneMsg ? (
            <p role="status" className="font-semibold text-mu-ok">
              {doneMsg}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="font-semibold text-mu-err">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
