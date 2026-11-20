"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ds/Button";
import { Sheet } from "@/components/ds/Sheet";
import { formatKRW } from "@/lib/shared/format";

export type ScheduleRebalancePreview = {
  shouldSuggest: boolean;
  message: string;
  adjustmentsLog: string[];
  remainingBudgetKrw: number;
  remainingScheduleEstKrw: number;
  gapKrw: number;
  droppedCount: number;
};

type Props = {
  open: boolean;
  tripId: string;
  onClose: () => void;
  /** 일정 반영 후 로컬 여행 갱신 */
  onApplied: () => void;
};

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; preview: ScheduleRebalancePreview }
  | { status: "error"; message: string };

export function ScheduleRebalanceSheet({
  open,
  tripId,
  onClose,
  onApplied,
}: Props) {
  const [load, setLoad] = useState<LoadState>({ status: "idle" });
  const [busy, setBusy] = useState(false);
  const [applyErr, setApplyErr] = useState("");

  const loadPreview = useCallback(async () => {
    setLoad({ status: "loading" });
    setApplyErr("");
    try {
      const res = await fetch(`/api/trips/${tripId}/rebalance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview" }),
      });
      if (!res.ok) {
        console.error("[ScheduleRebalanceSheet] preview", await res.text());
        setLoad({
          status: "error",
          message: "조정안을 불러오지 못했어요. 잠시 후 다시 해 주세요.",
        });
        return;
      }
      const json = (await res.json()) as ScheduleRebalancePreview & {
        ok?: boolean;
      };
      setLoad({
        status: "ready",
        preview: {
          shouldSuggest: Boolean(json.shouldSuggest),
          message:
            typeof json.message === "string" && json.message.trim()
              ? json.message.trim()
              : "일정을 확인해요.",
          adjustmentsLog: Array.isArray(json.adjustmentsLog)
            ? json.adjustmentsLog.filter(
                (l): l is string => typeof l === "string" && l.trim().length > 0
              )
            : [],
          remainingBudgetKrw: Math.max(
            0,
            Math.trunc(Number(json.remainingBudgetKrw) || 0)
          ),
          remainingScheduleEstKrw: Math.max(
            0,
            Math.trunc(Number(json.remainingScheduleEstKrw) || 0)
          ),
          gapKrw: Math.trunc(Number(json.gapKrw) || 0),
          droppedCount: Math.max(0, Math.trunc(Number(json.droppedCount) || 0)),
        },
      });
    } catch (err) {
      console.error("[ScheduleRebalanceSheet] preview", err);
      setLoad({
        status: "error",
        message: "네트워크 오류가 났어요. 연결을 확인해 주세요.",
      });
    }
  }, [tripId]);

  useEffect(() => {
    if (!open) {
      setLoad({ status: "idle" });
      setApplyErr("");
      setBusy(false);
      return;
    }
    void loadPreview();
  }, [open, loadPreview]);

  async function apply() {
    if (busy) return;
    setBusy(true);
    setApplyErr("");
    try {
      const res = await fetch(`/api/trips/${tripId}/rebalance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "apply" }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        applied?: boolean;
        reason?: string;
      };
      if (!res.ok) {
        console.error("[ScheduleRebalanceSheet] apply", body);
        setApplyErr("일정에 반영하지 못했어요. 잠시 후 다시 해 주세요.");
        return;
      }
      if (body.applied === false && body.reason === "within-budget") {
        onClose();
        return;
      }
      onApplied();
      onClose();
    } catch (err) {
      console.error("[ScheduleRebalanceSheet] apply", err);
      setApplyErr("네트워크 오류가 났어요. 연결을 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  const preview = load.status === "ready" ? load.preview : null;
  const canApply = Boolean(preview?.shouldSuggest && preview.adjustmentsLog.length > 0);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="일정 조정 제안"
      footer={
        preview?.shouldSuggest ? (
          <div className="flex gap-2">
            <Button
              className="flex-1"
              loading={busy}
              disabled={busy || !canApply}
              onClick={() => void apply()}
            >
              일정에 반영하기
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              disabled={busy}
              onClick={onClose}
            >
              나중에
            </Button>
          </div>
        ) : (
          <Button className="w-full" variant="secondary" onClick={onClose}>
            닫기
          </Button>
        )
      }
    >
      {load.status === "loading" || load.status === "idle" ? (
        <p className="text-mu-body text-mu-fg-2">조정안을 계산하고 있어요…</p>
      ) : null}

      {load.status === "error" ? (
        <div className="flex flex-col gap-3">
          <p role="alert" className="text-mu-body text-mu-err">
            {load.message}
          </p>
          <Button variant="secondary" onClick={() => void loadPreview()}>
            다시 시도
          </Button>
        </div>
      ) : null}

      {preview ? (
        <div className="flex flex-col gap-4">
          <p className="text-mu-body text-mu-fg-2">{preview.message}</p>

          <dl className="grid grid-cols-2 gap-2 text-mu-caption">
            <div className="rounded-mu-md bg-mu-sunken px-3 py-2">
              <dt className="font-medium text-mu-fg-3">남은 예산</dt>
              <dd className="mu-num mt-0.5 font-bold text-mu-fg">
                {formatKRW(preview.remainingBudgetKrw)}
              </dd>
            </div>
            <div className="rounded-mu-md bg-mu-sunken px-3 py-2">
              <dt className="font-medium text-mu-fg-3">남은 일정 추정</dt>
              <dd className="mu-num mt-0.5 font-bold text-mu-fg">
                {formatKRW(preview.remainingScheduleEstKrw)}
              </dd>
            </div>
          </dl>

          {preview.gapKrw > 0 ? (
            <p className="text-mu-caption font-semibold text-mu-warn">
              일정이 예산보다 {formatKRW(preview.gapKrw)} 더 커요.
              {preview.droppedCount > 0
                ? ` ${preview.droppedCount}개를 빼거나 줄이는 안이에요.`
                : null}
            </p>
          ) : null}

          {preview.adjustmentsLog.length > 0 ? (
            <ul
              aria-label="조정 항목"
              className="max-h-56 space-y-2 overflow-y-auto rounded-mu-md border border-mu-line bg-mu-card px-3 py-3"
            >
              {preview.adjustmentsLog.map((line, i) => (
                <li
                  key={`adj-${i}`}
                  className="border-b border-mu-line pb-2 text-mu-caption leading-snug text-mu-fg-2 last:border-0 last:pb-0"
                >
                  {line}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-mu-caption text-mu-fg-3">
              {preview.shouldSuggest
                ? "줄일 수 있는 유동 일정이 거의 없어요. 고정비(항공·숙소)는 건드리지 않아요."
                : "지금은 남은 예산 안에 일정이 들어가요."}
            </p>
          )}

          {applyErr ? (
            <p role="alert" className="text-mu-caption text-mu-err">
              {applyErr}
            </p>
          ) : null}
        </div>
      ) : null}
    </Sheet>
  );
}
