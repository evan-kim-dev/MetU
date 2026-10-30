"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MobileShell } from "@/components/layout/MobileShell";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  agentEventStatusLabel,
  formatRelativeKo,
  formatSmsPreviewLabel,
  type SmsParsePreviewLabel,
} from "@/lib/agent/event-status";
import { formatKRW } from "@/lib/shared/format";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { useTrips } from "@/lib/trips/TripProvider";

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
  trip_id: string | null;
  source: string;
  kind: string;
  status: string;
  payload: { text?: string } | null;
  result: {
    items?: ResultItem[];
    reason?: string;
    preview?: SmsParsePreviewLabel & { confidence?: number; kind?: string };
  } | null;
  error: string | null;
  created_at: string;
  processed_at: string | null;
};

type TripOption = { id: string; label: string };

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

export function AgentInbox({
  tripId,
  trips: tripsProp,
}: {
  /** When omitted, shows all of the user's events (user-scoped inbox). */
  tripId?: string | null;
  trips?: TripOption[];
}) {
  const { user, provider } = useAuth();
  const { activeTrips } = useTrips();
  const trips = useMemo(
    () =>
      tripsProp ??
      activeTrips.map((t) => ({
        id: t.id,
        label: `${t.destination} · ${t.dateRange}`,
      })),
    [tripsProp, activeTrips]
  );
  const [events, setEvents] = useState<AgentEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ignoredOpen, setIgnoredOpen] = useState(false);
  const [filterUnassigned, setFilterUnassigned] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = getBrowserSupabase();
    if (!supabase || !user || provider === "guest") {
      setLoading(false);
      setError("로그인 후 인박스를 볼 수 있어요.");
      return;
    }
    setError("");
    let q = supabase
      .from("agent_events")
      .select(
        "id, trip_id, source, kind, status, payload, result, error, created_at, processed_at"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(80);

    if (tripId) {
      q = q.eq("trip_id", tripId);
    }

    const { data, error: qErr } = await q;

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
    const filter = tripId
      ? `trip_id=eq.${tripId}`
      : `user_id=eq.${user.id}`;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel(`agent_inbox:${tripId ?? "user"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "agent_events",
          filter,
        },
        () => {
          // received→processing→done can fire 3+ times; coalesce reloads.
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            void load();
          }, 600);
        }
      )
      .subscribe();
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      void supabase.removeChannel(channel);
    };
  }, [tripId, user, load]);

  const groups = useMemo(() => {
    const scoped = filterUnassigned
      ? events.filter((e) => e.status === "unassigned" || e.trip_id == null)
      : events;
    const unassigned = events.filter(
      (e) => e.status === "unassigned" || (e.trip_id == null && e.status !== "ignored")
    );
    const processing = scoped.filter((e) =>
      ["received", "processing"].includes(e.status)
    );
    const autoDone = scoped.filter(
      (e) => e.status === "done" && autoItems(e).length > 0
    );
    const review = scoped.filter((e) => e.status === "needs_review");
    const failed = scoped.filter((e) => e.status === "failed");
    const ignored = scoped.filter((e) => e.status === "ignored");
    const doneQuiet = scoped.filter(
      (e) => e.status === "done" && autoItems(e).length === 0
    );
    const unassignedCards = scoped.filter((e) => e.status === "unassigned");
    return {
      processing,
      autoDone,
      review,
      failed,
      ignored,
      doneQuiet,
      unassigned,
      unassignedCards,
      scoped,
    };
  }, [events, filterUnassigned]);

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

  function renderAssign(event: AgentEventRow) {
    if (event.status !== "unassigned" && event.trip_id != null) return null;
    if (trips.length === 0) {
      return (
        <p className="mt-2 text-xs text-ink-muted">
          여행이 생기면 기간에 맞춰 자동으로 붙어요.{" "}
          <Link href="/onboarding" className="font-bold text-brand">
            여행 만들기
          </Link>
        </p>
      );
    }
    return (
      <label className="mt-2 flex flex-col gap-1 text-xs">
        <span className="font-bold text-ink-heading">여행에 배정</span>
        <select
          className="min-h-11 rounded-lg border border-line px-3 py-2 text-sm"
          defaultValue=""
          disabled={busyId === event.id}
          onChange={(e) => {
            const next = e.target.value;
            if (!next) return;
            void withBusy(event.id, () =>
              post(`/api/agent/events/${event.id}/assign`, {
                tripId: next === "__none__" ? null : next,
              })
            );
          }}
        >
          <option value="" disabled>
            여행 선택
          </option>
          {trips.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
          {event.trip_id != null ? (
            <option value="__none__">미할당으로 되돌리기</option>
          ) : null}
        </select>
      </label>
    );
  }

  function renderActions(event: AgentEventRow) {
    const disabled = busyId === event.id;
    if (event.status === "unassigned") {
      return renderAssign(event);
    }
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
    const statusLabel = agentEventStatusLabel(event.status);
    return (
      <article
        key={event.id}
        className={`rounded-2xl border p-3 shadow-sm ${tone}`}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="rounded-full bg-surface-white/80 px-2 py-0.5 text-[10px] font-bold tracking-wide text-ink-muted">
            {label || statusLabel}
          </span>
          <time
            className="text-[10px] text-ink-muted"
            dateTime={event.created_at}
            title={new Date(event.created_at).toLocaleString("ko-KR", {
              timeZone: "Asia/Seoul",
            })}
          >
            {formatRelativeKo(event.created_at)}
            {" · "}
            {new Date(event.created_at).toLocaleString("ko-KR", {
              timeZone: "Asia/Seoul",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
        </div>
        {event.status === "unassigned" ? (
          <p className="mt-2 text-xs leading-relaxed text-amber-900">
            여행이 없어 보관 중이에요. 기간이 맞는 여행을 만들면 자동으로
            붙어요.
          </p>
        ) : null}
        <p className="mt-2 text-sm font-semibold text-ink-heading">
          {previewText(event)}
        </p>
        {event.result?.preview
          ? (() => {
              const label = formatSmsPreviewLabel(event.result.preview!);
              return label ? (
                <p className="mt-1 text-xs font-semibold text-brand">{label}</p>
              ) : null;
            })()
          : null}
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

  const connectHref = tripId
    ? `/trips/${tripId}/ledger/connect`
    : "/onboarding/automation";
  const backHref = tripId ? `/trips/${tripId}/ledger` : "/agent";

  return (
    <MobileShell
      title="에이전트 인박스"
      showBack
      backHref={backHref}
      showBottomNav={false}
    >
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-4">
        <p className="text-xs leading-relaxed text-ink-body">
          문자·공유로 들어온 자동 처리 결과예요. 여행이 없어도 먼저 모아 두고,
          기간이 맞으면 자동으로 붙여요.
        </p>

        {groups.unassigned.length > 0 ? (
          <button
            type="button"
            className={`min-h-11 rounded-xl px-3 py-2 text-left text-sm font-bold ${
              filterUnassigned
                ? "bg-brand text-white"
                : "bg-amber-50 text-amber-900 ring-1 ring-amber-200"
            }`}
            onClick={() => setFilterUnassigned((v) => !v)}
          >
            미할당 {groups.unassigned.length}건
            {filterUnassigned ? " · 전체 보기" : " · 필터"}
          </button>
        ) : null}

        {error ? (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="h-40 animate-pulse rounded-2xl bg-surface-soft" />
        ) : (
          <>
            {groups.unassignedCards.length > 0 ? (
              <section className="flex flex-col gap-2">
                <h2 className="text-sm font-extrabold text-ink-heading">
                  미할당
                </h2>
                {groups.unassignedCards.map((e) => (
                  <EventCard
                    key={e.id}
                    event={e}
                    label="미할당"
                    tone="border-amber-200 bg-amber-50/80"
                  />
                ))}
              </section>
            ) : null}

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

            {groups.scoped.length === 0 ? (
              <div className="rounded-2xl bg-surface-soft p-6 text-center text-sm leading-relaxed text-ink-muted">
                <p>아직 받은 알림이 없어요.</p>
                <p className="mt-2">
                  단축어가 연결되면 여기와 온보딩의 &apos;최근 수신&apos;에
                  나타나요.{" "}
                  <Link href={connectHref} className="font-bold text-brand">
                    연결하기
                  </Link>
                </p>
              </div>
            ) : null}
          </>
        )}

        <Link
          href={connectHref}
          className="text-center text-xs font-bold text-brand"
        >
          자동 수집 연결 설정
        </Link>
      </div>
    </MobileShell>
  );
}
