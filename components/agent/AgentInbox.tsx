"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MobileShell } from "@/components/layout/MobileShell";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatKRW } from "@/lib/shared/format";
import { getBrowserSupabase } from "@/lib/supabase/browser";

type ResultItem = {
  ref?: number;
  decision?: string;
  expenseId?: string;
  reasons?: string[];
  draft?: {
    merchant?: string | null;
    amount?: number | null;
    currency?: string | null;
  };
  priced?: { krwAmount?: number; amount?: number; currency?: string };
};

type AgentEventRow = {
  id: string;
  trip_id: string;
  source: string;
  kind: string;
  status: string;
  payload: { text?: string } | null;
  result: { items?: ResultItem[]; reason?: string } | null;
  error: string | null;
  created_at: string;
  processed_at: string | null;
};

function previewText(event: AgentEventRow): string {
  const text =
    typeof event.payload?.text === "string" ? event.payload.text.trim() : "";
  if (text) return text.length > 120 ? `${text.slice(0, 120)}…` : text;
  if (event.result?.reason) return event.result.reason;
  return event.kind === "image" ? "영수증 이미지" : "자동 수집 이벤트";
}

function autoItems(event: AgentEventRow): ResultItem[] {
  const items = event.result?.items ?? [];
  return items.filter((it) => it.decision === "auto_commit" && it.expenseId);
}

function reviewItems(event: AgentEventRow): ResultItem[] {
  return (event.result?.items ?? []).filter((it) => it.decision === "review");
}

export function AgentInbox({ tripId }: { tripId: string }) {
  const { user, provider } = useAuth();
  const [events, setEvents] = useState<AgentEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ignoredOpen, setIgnoredOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = getBrowserSupabase();
    if (!supabase || !user || provider === "guest") {
      setLoading(false);
      setError("로그인 후 인박스를 볼 수 있어요.");
      return;
    }
    setError("");
    const { data, error: qErr } = await supabase
      .from("agent_events")
      .select(
        "id, trip_id, source, kind, status, payload, result, error, created_at, processed_at"
      )
      .eq("trip_id", tripId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(80);

    if (qErr) {
      setError(qErr.message);
      setLoading(false);
      return;
    }
    setEvents((data ?? []) as AgentEventRow[]);
    setLoading(false);
  }, [tripId, user, provider]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase || !user) return;
    const channel = supabase
      .channel(`agent_inbox:${tripId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "agent_events",
          filter: `trip_id=eq.${tripId}`,
        },
        () => {
          void load();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [tripId, user, load]);

  const groups = useMemo(() => {
    const processing = events.filter((e) =>
      ["received", "processing"].includes(e.status)
    );
    const autoDone = events.filter(
      (e) => e.status === "done" && autoItems(e).length > 0
    );
    const review = events.filter((e) => e.status === "needs_review");
    const failed = events.filter((e) => e.status === "failed");
    const ignored = events.filter((e) => e.status === "ignored");
    const doneQuiet = events.filter(
      (e) => e.status === "done" && autoItems(e).length === 0
    );
    return { processing, autoDone, review, failed, ignored, doneQuiet };
  }, [events]);

  async function post(path: string, body?: unknown) {
    const res = await fetch(path, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
    };
    if (!res.ok) throw new Error(json.error ?? "request-failed");
  }

  async function withBusy(id: string, fn: () => Promise<void>) {
    setBusyId(id);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "요청 실패");
    } finally {
      setBusyId(null);
    }
  }

  function renderActions(event: AgentEventRow) {
    const disabled = busyId === event.id;
    if (event.status === "needs_review") {
      return (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled}
            className="rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
            onClick={() =>
              void withBusy(event.id, () =>
                post(`/api/agent/events/${event.id}/confirm`)
              )
            }
          >
            가계부에 추가
          </button>
          <button
            type="button"
            disabled={disabled}
            className="rounded-lg bg-surface-soft px-3 py-1.5 text-xs font-bold text-ink-body disabled:opacity-50"
            onClick={() =>
              void withBusy(event.id, () =>
                post(`/api/agent/events/${event.id}/dismiss`)
              )
            }
          >
            무시
          </button>
        </div>
      );
    }
    if (event.status === "failed") {
      return (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled}
            className="rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
            onClick={() =>
              void withBusy(event.id, () =>
                post(`/api/agent/events/${event.id}/retry`)
              )
            }
          >
            다시 처리
          </button>
          <button
            type="button"
            disabled={disabled}
            className="rounded-lg bg-surface-soft px-3 py-1.5 text-xs font-bold text-ink-body disabled:opacity-50"
            onClick={() =>
              void withBusy(event.id, () =>
                post(`/api/agent/events/${event.id}/dismiss`)
              )
            }
          >
            무시
          </button>
        </div>
      );
    }
    return null;
  }

  function renderAutoUndo(event: AgentEventRow) {
    const autos = autoItems(event);
    if (autos.length === 0) return null;
    return (
      <ul className="mt-2 space-y-1">
        {autos.map((it) => (
          <li
            key={`${event.id}-${it.ref}-${it.expenseId}`}
            className="flex items-center justify-between rounded-lg bg-surface-soft px-2 py-1.5 text-xs"
          >
            <span className="text-ink-body">
              {it.draft?.merchant ?? "지출"}{" "}
              {it.priced?.krwAmount != null
                ? formatKRW(it.priced.krwAmount)
                : it.draft?.amount != null
                  ? `${it.draft.amount} ${it.draft.currency ?? ""}`
                  : null}
            </span>
            <button
              type="button"
              disabled={busyId === it.expenseId}
              className="font-bold text-brand disabled:opacity-50"
              onClick={() =>
                void withBusy(it.expenseId!, () =>
                  post(`/api/agent/expenses/${it.expenseId}/undo`)
                )
              }
            >
              실행 취소
            </button>
          </li>
        ))}
      </ul>
    );
  }

  function EventCard({
    event,
    tone,
    label,
  }: {
    event: AgentEventRow;
    tone: string;
    label: string;
  }) {
    const reviews = reviewItems(event);
    return (
      <article
        key={event.id}
        className={`rounded-2xl border p-3 shadow-sm ${tone}`}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="rounded-full bg-surface-white/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-muted">
            {label}
          </span>
          <time className="text-[10px] text-ink-muted">
            {new Date(event.created_at).toLocaleString("ko-KR", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
        </div>
        <p className="mt-2 text-sm font-semibold text-ink-heading">
          {previewText(event)}
        </p>
        {event.error ? (
          <p className="mt-1 text-xs text-danger">{event.error}</p>
        ) : null}
        {reviews.length > 0 ? (
          <ul className="mt-2 space-y-1 text-xs text-ink-body">
            {reviews.map((it) => (
              <li key={`${event.id}-r-${it.ref}`}>
                {(it.reasons ?? []).join(" · ") ||
                  `${it.draft?.merchant ?? "항목"} 확인 필요`}
              </li>
            ))}
          </ul>
        ) : null}
        {renderAutoUndo(event)}
        {renderActions(event)}
      </article>
    );
  }

  return (
    <MobileShell
      title="에이전트 인박스"
      showBack
      backHref={`/trips/${tripId}/ledger`}
      showBottomNav={false}
    >
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-4">
        <p className="text-xs leading-relaxed text-ink-body">
          문자·공유로 들어온 자동 처리 결과예요. 확인이 필요한 항목만
          승인하면 가계부에 반영돼요.
        </p>

        {error ? (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="h-40 animate-pulse rounded-2xl bg-surface-soft" />
        ) : (
          <>
            {groups.processing.length > 0 ? (
              <section className="flex flex-col gap-2">
                <h2 className="text-sm font-extrabold text-ink-heading">
                  처리 중
                </h2>
                {groups.processing.map((e) => (
                  <EventCard
                    key={e.id}
                    event={e}
                    label="처리 중"
                    tone="border-brand/20 bg-brand/5"
                  />
                ))}
              </section>
            ) : null}

            {groups.review.length > 0 ? (
              <section className="flex flex-col gap-2">
                <h2 className="text-sm font-extrabold text-ink-heading">
                  확인 필요
                </h2>
                {groups.review.map((e) => (
                  <EventCard
                    key={e.id}
                    event={e}
                    label="확인 필요"
                    tone="border-amber-200 bg-amber-50/80"
                  />
                ))}
              </section>
            ) : null}

            {groups.failed.length > 0 ? (
              <section className="flex flex-col gap-2">
                <h2 className="text-sm font-extrabold text-ink-heading">
                  실패
                </h2>
                {groups.failed.map((e) => (
                  <EventCard
                    key={e.id}
                    event={e}
                    label="실패"
                    tone="border-danger/30 bg-danger/5"
                  />
                ))}
              </section>
            ) : null}

            {groups.autoDone.length > 0 ? (
              <section className="flex flex-col gap-2">
                <h2 className="text-sm font-extrabold text-ink-heading">
                  자동 추가됨
                </h2>
                {groups.autoDone.map((e) => (
                  <EventCard
                    key={e.id}
                    event={e}
                    label="자동 추가"
                    tone="border-emerald-200 bg-emerald-50/60"
                  />
                ))}
              </section>
            ) : null}

            {groups.ignored.length > 0 ? (
              <section className="flex flex-col gap-2">
                <button
                  type="button"
                  className="flex items-center justify-between text-sm font-extrabold text-ink-muted"
                  onClick={() => setIgnoredOpen((v) => !v)}
                >
                  <span>무시됨 ({groups.ignored.length})</span>
                  <span>{ignoredOpen ? "▲" : "▼"}</span>
                </button>
                {ignoredOpen
                  ? groups.ignored.map((e) => (
                      <EventCard
                        key={e.id}
                        event={e}
                        label="무시"
                        tone="border-surface-soft bg-surface-soft/50 opacity-80"
                      />
                    ))
                  : null}
              </section>
            ) : null}

            {events.length === 0 ? (
              <div className="rounded-2xl bg-surface-soft p-6 text-center text-sm text-ink-muted">
                아직 자동 수집 이벤트가 없어요.{" "}
                <Link
                  href={`/trips/${tripId}/ledger/connect`}
                  className="font-bold text-brand"
                >
                  연결하기
                </Link>
              </div>
            ) : null}
          </>
        )}

        <Link
          href={`/trips/${tripId}/ledger/connect`}
          className="text-center text-xs font-bold text-brand"
        >
          자동 수집 연결 설정
        </Link>
      </div>
    </MobileShell>
  );
}
