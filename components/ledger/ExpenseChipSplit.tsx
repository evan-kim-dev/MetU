"use client";

import { useMemo, useState } from "react";

import { ExpenseMemberChips } from "@/components/ledger/ExpenseMemberChips";
import { ExpensePayerSheet } from "@/components/ledger/ExpensePayerSheet";
import { SplitPreviewSheet } from "@/components/ledger/SplitPreviewSheet";
import type {
  SplitPatch,
  SplitPreviewBusy,
  SplitPreviewPayload,
} from "@/components/ledger/split-preview-types";
import type { LedgerExpenseRow, TripMember } from "@/lib/ledger/types";
import { formatKRW } from "@/lib/shared/format";

type Props = {
  expense: LedgerExpenseRow;
  members: TripMember[];
  meId: string | undefined;
  isAnonymous: boolean;
  isOwner: boolean;
  onChanged: () => void | Promise<void>;
  settleHref?: string;
};

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * 지출 카드 + 멤버 칩 → 미리보기 → 적용/되돌리기 (LLM 없음).
 */
export function ExpenseChipSplit({
  expense,
  members,
  meId,
  isAnonymous,
  isOwner,
  onChanged,
  settleHref,
}: Props) {
  const [busy, setBusy] = useState<SplitPreviewBusy>(null);
  const [preview, setPreview] = useState<SplitPreviewPayload | null>(null);
  const [patch, setPatch] = useState<SplitPatch | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [doneMsg, setDoneMsg] = useState("");
  const [payerOpen, setPayerOpen] = useState(false);
  const [staleSettle, setStaleSettle] = useState(false);

  const interactive = useMemo(() => {
    const ids = new Set<string>();
    if (isOwner && !isAnonymous) {
      for (const m of members) ids.add(m.id);
    } else if (meId) {
      ids.add(meId);
    }
    return ids;
  }, [isOwner, isAnonymous, members, meId]);

  const payerName =
    members.find((m) => m.id === expense.paidBy)?.displayName ?? "";

  async function onToggle(memberId: string, action: "exclude" | "include") {
    if (busy) return;
    setBusy("preview");
    setError("");
    setDoneMsg("");
    setHistoryId(null);
    setPreview(null);
    setPatch(null);
    try {
      const res = await fetch("/api/ledger/split-patch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expenseId: expense.id,
          chip: { memberId, action },
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        patch?: SplitPatch;
        preview?: SplitPreviewPayload;
        message?: string;
        error?: string;
      };
      if (!res.ok || !data.preview || !data.patch) {
        setError(
          data.message ??
            (data.error === "guest-self-only"
              ? "호스트만 바꿀 수 있어요."
              : "미리보기에 실패했어요.")
        );
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

  async function onApply() {
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
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(
          data.message ??
            (data.error === "conflict"
              ? "그 사이 분담이 바뀌었어요. 다시 칩을 눌러 주세요."
              : "적용에 실패했어요.")
        );
        if (data.error === "conflict") {
          setPreview(null);
          setPatch(null);
        }
        return;
      }
      setHistoryId(data.historyId ?? null);
      setDoneMsg(
        data.already ? "이미 적용된 요청이에요." : "분담을 바꿨어요."
      );
      setStaleSettle(true);
      setPreview(null);
      setPatch(null);
      await onChanged();
    } catch {
      setError("네트워크 오류예요. 연결을 확인해 주세요.");
    } finally {
      setBusy(null);
    }
  }

  async function onUndo() {
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
        message?: string;
      };
      if (!res.ok) {
        setError(data.message ?? "되돌리기에 실패했어요.");
        return;
      }
      setDoneMsg(
        data.already ? "이미 되돌린 변경이에요." : "원래대로 되돌렸어요."
      );
      setHistoryId(null);
      setStaleSettle(true);
      await onChanged();
    } catch {
      setError("네트워크 오류예요. 연결을 확인해 주세요.");
    } finally {
      setBusy(null);
    }
  }

  const hasShares = Object.keys(expense.shares ?? {}).length > 0;

  return (
    <li className="rounded-xl bg-surface-soft px-3 py-3 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink-heading">
            {expense.merchant || expense.label}
          </p>
          {payerName ? (
            <p className="mt-0.5 text-ink-muted">결제 {payerName}</p>
          ) : null}
        </div>
        <span className="shrink-0 font-bold">{formatKRW(expense.krwAmount)}</span>
      </div>

      {hasShares ? (
        <ExpenseMemberChips
          members={members}
          shares={expense.shares}
          interactiveMemberIds={interactive}
          disabled={Boolean(busy)}
          onToggle={(id, action) => void onToggle(id, action)}
        />
      ) : null}

      {preview ? (
        <div className="mt-2">
          <SplitPreviewSheet
            preview={preview}
            busy={busy}
            historyId={null}
            error={error}
            doneMsg=""
            showActions
            onApply={() => void onApply()}
            onClose={() => {
              setPreview(null);
              setPatch(null);
              setError("");
            }}
          />
        </div>
      ) : null}

      {!preview && historyId ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={Boolean(busy)}
            className="inline-flex min-h-[44px] items-center rounded-lg border border-amber-600 px-3 text-xs font-bold text-amber-800 disabled:opacity-40"
            onClick={() => void onUndo()}
          >
            되돌리기
          </button>
        </div>
      ) : null}

      {!preview && error ? (
        <p role="alert" className="mt-2 font-semibold text-danger">
          {error}
        </p>
      ) : null}
      {!preview && doneMsg ? (
        <p role="status" className="mt-2 font-semibold text-emerald-800">
          {doneMsg}
        </p>
      ) : null}
      {isOwner && !isAnonymous ? (
        <button
          type="button"
          className="mt-2 inline-flex min-h-[44px] items-center font-bold text-brand underline"
          onClick={() => setPayerOpen(true)}
        >
          결제자 바꾸기
        </button>
      ) : null}

      {staleSettle && isOwner && settleHref ? (
        <p className="mt-2 text-ink-muted">
          정산이 오래됐어요.{" "}
          <a href={settleHref} className="font-bold text-brand underline">
            정산 화면
          </a>
          에서 다시 계산해 주세요.
        </p>
      ) : null}

      {isOwner && !isAnonymous ? (
        <ExpensePayerSheet
          open={payerOpen}
          onClose={() => setPayerOpen(false)}
          expenseId={expense.id}
          members={members}
          currentPayerId={expense.paidBy}
          onSaved={async () => {
            setStaleSettle(true);
            setDoneMsg("결제자를 바꿨어요. 정산이 오래됐을 수 있어요.");
            await onChanged();
          }}
        />
      ) : null}
    </li>
  );
}
