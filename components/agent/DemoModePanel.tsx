"use client";

import Link from "next/link";
import { useState } from "react";

import { isDemoModeEnabled } from "@/lib/demo/mode";

type SeedResponse = {
  tripId: string;
  memberIds: string[];
  reused?: boolean;
};

type NotifyResponse = {
  eventId: string;
  duplicate?: boolean;
  status: string;
  tripId: string;
  step: number;
  label: string;
  startedAtMs: number;
  acceptedAtMs: number;
};

type LastNotify = NotifyResponse & { polled?: string };

const DEMO_ENABLED = isDemoModeEnabled();
const STEPS = [1, 2, 3, 4] as const;

export function DemoModePanel() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tripId, setTripId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [last, setLast] = useState<LastNotify | null>(null);

  if (!DEMO_ENABLED) return null;

  async function seed() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/agent/demo/seed", { method: "POST" });
      const json = (await res.json()) as SeedResponse & { error?: string };
      if (!res.ok) {
        setMessage(json.error ?? "데모 여행을 만들지 못했어요.");
        return;
      }
      setTripId(json.tripId);
      setMessage(
        json.reused
          ? "기존 데모 여행을 재사용했어요."
          : "데모 여행을 만들었어요."
      );
    } catch {
      setMessage("네트워크 오류가 났어요.");
    } finally {
      setBusy(false);
    }
  }

  async function notify(step: number) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/agent/demo/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step }),
      });
      const json = (await res.json()) as NotifyResponse & {
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        setMessage(json.message ?? json.error ?? "데모 알림을 보내지 못했어요.");
        return;
      }
      setTripId(json.tripId);
      setLast(json);
      setMessage(
        json.duplicate
          ? `데모 알림 ${step}은 같은 분에 이미 보냈어요.`
          : `데모 알림 ${step}을 보냈어요.`
      );

      // Light poll: automation-status recentEvents (sim included in list).
      window.setTimeout(async () => {
        try {
          const st = await fetch("/api/agent/automation-status");
          if (!st.ok) return;
          const body = (await st.json()) as {
            recentEvents?: Array<{ id: string; status: string }>;
          };
          const hit = body.recentEvents?.find((e) => e.id === json.eventId);
          if (hit) {
            setLast((prev) =>
              prev && prev.eventId === json.eventId
                ? { ...prev, polled: hit.status }
                : prev
            );
          }
        } catch {
          /* ignore poll errors */
        }
      }, 1500);
    } catch {
      setMessage("네트워크 오류가 났어요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl bg-surface-soft p-4 ring-1 ring-line-soft">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full items-center justify-between text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        aria-expanded={open}
      >
        <span>
          <span className="block text-sm font-extrabold text-ink-heading">
            데모 모드
          </span>
          <span className="block text-xs text-ink-body">
            데모 데이터로 알림→기록 흐름을 재현해요
          </span>
        </span>
        <span className="text-xs font-bold text-brand">
          {open ? "접기" : "펼치기"}
        </span>
      </button>

      {open ? (
        <div className="mt-3 flex flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void seed()}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-3 text-sm font-bold text-surface-white disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            데모 여행 만들기
          </button>
          <div className="grid grid-cols-2 gap-2">
            {STEPS.map((step) => (
              <button
                key={step}
                type="button"
                disabled={busy}
                onClick={() => void notify(step)}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-surface-white px-2 text-xs font-bold text-ink-heading ring-1 ring-line-soft disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                데모 알림 보내기 {step}/4
              </button>
            ))}
          </div>
          {message ? (
            <p role="status" className="text-xs text-ink-body">
              {message}
            </p>
          ) : null}
          {last ? (
            <p className="text-xs text-ink-body">
              이벤트 {last.eventId.slice(0, 8)}… · 수락 상태 {last.status}
              {last.polled ? ` · 처리 ${last.polled}` : ""}
              {last.duplicate ? " · 중복" : ""}
            </p>
          ) : null}
          {tripId ? (
            <div className="flex flex-wrap gap-3 text-xs font-bold text-brand">
              <Link
                href={`/trips/${tripId}/ledger`}
                className="inline-flex min-h-11 items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                데모 가계부
              </Link>
              <Link
                href={`/trips/${tripId}/ledger/settle`}
                className="inline-flex min-h-11 items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                데모 정산
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
