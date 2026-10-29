"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { applyPatch, type PatchScheduleCandidate } from "@/lib/itinerary/apply-patch";
import type { PatchOp } from "@/lib/ai/contracts";
import type { TripDaySchedule } from "@/lib/trips/types";

type PatchResponse = {
  ops: PatchOp[];
  explanation: string;
  needsClarification?: string | null;
  candidates?: PatchScheduleCandidate[];
  source?: string;
};

interface ItineraryChatBarProps {
  city: string;
  country?: string;
  styles: string[];
  nights: number;
  dailySchedule: TripDaySchedule[];
  onScheduleChange: (next: TripDaySchedule[]) => void;
}

export function ItineraryChatBar({
  city,
  country,
  styles,
  nights,
  dailySchedule,
  onScheduleChange,
}: ItineraryChatBarProps) {
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const disabled =
    loading || !instruction.trim() || dailySchedule.length === 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled) return;
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/itinerary/patch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instruction: instruction.trim(),
          city,
          country,
          styles,
          nights,
          dailySchedule,
        }),
      });

      if (!res.ok) {
        setError("일정 수정 요청에 실패했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }

      const data = (await res.json()) as PatchResponse;

      if (data.needsClarification) {
        setMessage(data.needsClarification);
        return;
      }

      if (!data.ops?.length) {
        setMessage(data.explanation || "변경할 내용을 찾지 못했어요.");
        return;
      }

      const candMap = new Map<string, PatchScheduleCandidate>();
      for (const c of data.candidates ?? []) {
        candMap.set(c.id, c);
      }

      const next = applyPatch(dailySchedule, data.ops, candMap);
      onScheduleChange(next);
      setInstruction("");
      setMessage(data.explanation || "일정을 반영했어요.");
    } catch {
      setError("네트워크 오류가 났어요.");
    } finally {
      setLoading(false);
    }
  }

  const hasPlaceItems = dailySchedule.some((d) =>
    d.items.some((i) => Boolean(i.placeId))
  );
  if (!hasPlaceItems) return null;

  return (
    <div className="mb-4 rounded-2xl border border-line-soft bg-surface-white p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-sm font-bold text-ink-heading">
        <Sparkles className="h-4 w-4 text-brand" />
        AI 일정 수정
      </div>
      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-2">
        <input
          type="text"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="예: 2일차 점심을 다른 맛집으로 바꿔줘"
          maxLength={300}
          className="h-10 w-full rounded-xl border border-line-muted px-3 text-sm text-ink-body focus:border-brand focus:outline-none"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={disabled}
          className="h-9 rounded-xl bg-brand text-sm font-bold text-white disabled:opacity-50"
        >
          {loading ? "반영 중…" : "반영하기"}
        </button>
      </form>
      {error ? (
        <p className="mt-2 text-xs font-semibold text-danger">{error}</p>
      ) : null}
      {message ? (
        <p className="mt-2 text-xs font-medium text-ink-caption">{message}</p>
      ) : null}
    </div>
  );
}
