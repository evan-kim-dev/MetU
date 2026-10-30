"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MobileShell } from "@/components/layout/MobileShell";
import { QuickTripSheet } from "@/components/trips/QuickTripSheet";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  agentEventStatusLabelForUi,
  formatRelativeKo,
  formatSmsPreviewLabel,
  type SmsParsePreviewLabel,
} from "@/lib/agent/event-status";
import { toUserFacingError } from "@/lib/errors/user-message";
import { useAutomationStatus } from "@/lib/hooks/useAutomationStatus";
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

function isTestEvent(event: AgentEventRow): boolean {
  const text =
    typeof event.payload?.text === "string" ? event.payload.text.trim() : "";
  return text.startsWith("MTU-TEST");
}

function autoItems(event: AgentEventRow): ResultItem[] {
  const items = event.result?.items ?? [];
  return items.filter((it) => it.decision === "auto_commit" && it.expenseId);
}

function reviewItems(event: AgentEventRow): ResultItem[] {
  return (event.result?.items ?? []).filter((it) => it.decision === "review");
}

function looksLikeJwtExpired(message: string): boolean {
  return /jwt|session|401|unauthorized|expired/i.test(message);
}

export function AgentInbox({
  tripId,
  trips: tripsProp,
}: {
  /** When omitted, shows all of the user's events (user-scoped inbox). */
  tripId?: string | null;
  trips?: TripOption[];
}) {
  const { user, provider, isReady: authReady, isLoggedIn } = useAuth();
  const isGuest = provider === "guest" || !user;
  const { activeTrips, trips: allTrips } = useTrips();
  const trips = useMemo(
    () =>
      tripsProp ??
      activeTrips.map((t) => ({
        id: t.id,
        label: `${t.destination} · ${t.dateRange}`,
      })),
    [tripsProp, activeTrips]
  );
  const automationEnabled = authReady && isLoggedIn && !isGuest;
  const { data: automationData, uiState } = useAutomationStatus({
    enabled: automationEnabled,
    lite: true,
  });
  const showBottomNav =
    automationData?.status === "done" ||
    automationData?.status === "partial" ||
    automationData?.status === "skipped";

  const [events, setEvents] = useState<AgentEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [offlineHint, setOfflineHint] = useState(false);
  const [reloadBusy, setReloadBusy] = useState(false);
  const [ignoredOpen, setIgnoredOpen] = useState(false);
  const [filterUnassigned, setFilterUnassigned] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [sheetOpen, setSheetOpen] = useState(false);

  const load = useCallback(async () => {
    if (isGuest) {
      setLoading(false);
      setError("");
      return;
    }
    const supabase = getBrowserSupabase();
    if (!supabase || !user) {
      setLoading(false);
      setError("");
      return;
    }
    setError("");
    setOfflineHint(false);
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

    try {
      const { data, error: qErr } = await q;
      if (qErr) {
        const offline =
          typeof navigator !== "undefined" && navigator.onLine === false;
        if (offline) {
          setOfflineHint(true);
          setError("");
          setLoading(false);
          return;
        }
        const mapped = toUserFacingError({
          source: looksLikeJwtExpired(qErr.message) ? "api" : "unknown",
          status: looksLikeJwtExpired(qErr.message) ? 401 : undefined,
          message: qErr.message,
        });
        if (mapped.code === "session-expired" && typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("metu:session-expired"));
        }
        if (mapped.code === "network") {
          setOfflineHint(true);
          setError("");
        } else {
          setError("알림을 불러오지 못했어요.");
        }
        setLoading(false);
        return;
      }
      setEvents((data ?? []) as AgentEventRow[]);
      setLoading(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const mapped = toUserFacingError({
        source: "network",
        message,
      });
      if (mapped.code === "network") {
        setOfflineHint(true);
        setError("");
      } else {
        setError("알림을 불러오지 못했어요.");
      }
      setLoading(false);
    }
  }, [tripId, user, isGuest]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (isGuest) return;
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
  }, [tripId, user, load, isGuest]);

  const groups = useMemo(() => {
    const scoped = filterUnassigned
      ? events.filter((e) => e.status === "unassigned" || e.trip_id == null)
      : events;
    const unassigned = events.filter(
      (e) =>
        e.status === "unassigned" ||
        (e.trip_id == null && e.status !== "ignored")
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
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    try {
      await fn();
      await load();
    } catch {
      setRowErrors((prev) => ({
        ...prev,
        [id]: "요청에 실패했어요. 다시 시도해 주세요.",
      }));
    } finally {
      setBusyId(null);
    }
  }

  function onTripCreated() {
    void load();
    window.setTimeout(() => {
      void load();
    }, 1500);
  }

  function renderAssign(event: AgentEventRow) {
    if (event.status !== "unassigned" && event.trip_id != null) return null;
    if (trips.length === 0) {
      return (
        <p className="mt-2 text-xs text-ink-body">
          여행이 없어요. 만들면 기간이 맞는 알림이 자동으로 붙어요.{" "}
          <button
            type="button"
            className="font-bold text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            onClick={() => setSheetOpen(true)}
          >
            여행 만들기
          </button>
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
            className="min-h-11 rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
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
            className="min-h-11 rounded-lg bg-surface-soft px-3 py-1.5 text-xs font-bold text-ink-body disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
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
            className="min-h-11 rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
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
            className="min-h-11 rounded-lg bg-surface-soft px-3 py-1.5 text-xs font-bold text-ink-body disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
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
              className="min-h-11 font-bold text-brand disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
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
    const test = isTestEvent(event);
    const statusLabel = agentEventStatusLabelForUi({
      status: event.status,
      isTest: test,
    });
    const displayLabel = label || statusLabel;
    return (
      <article
        key={event.id}
        className={`rounded-2xl border p-3 shadow-sm ${tone} ${
          test ? "opacity-70" : ""
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="rounded-full bg-surface-white/80 px-2 py-0.5 text-xs font-bold tracking-wide text-ink-body">
            {test ? "연결 테스트" : displayLabel}
          </span>
          <time
            className="text-xs text-ink-body"
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
              const previewLabel = formatSmsPreviewLabel(event.result.preview!);
              return previewLabel ? (
                <p className="mt-1 text-xs font-semibold text-brand">
                  {previewLabel}
                </p>
              ) : null;
            })()
          : null}
        {rowErrors[event.id] ? (
          <p role="alert" className="mt-1 text-xs text-danger">
            {rowErrors[event.id]}
          </p>
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
  const connected = uiState === "ok" || uiState === "silent";
  const unassignedCount = groups.unassigned.length;
  const noTrips = allTrips.length === 0 && trips.length === 0;

  return (
    <MobileShell
      title="수신함"
      showBack
      backHref={backHref}
      showBottomNav={showBottomNav}
    >
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-4">
        <p className="text-xs leading-relaxed text-ink-body">
          받은 카드 알림
        </p>

        {isGuest ? (
          <section className="rounded-2xl bg-surface-white p-5 text-center shadow-sm ring-1 ring-line-soft">
            <h2 className="text-base font-extrabold text-ink-heading">
              로그인하면 받은 알림을 볼 수 있어요
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-body">
              카드·은행 알림을 자동으로 모아 가계부에 넣어 드려요.
            </p>
            <Link
              href="/login?next=/agent/inbox"
              className="ai-gradient-bg mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-2xl text-sm font-bold text-surface-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              로그인하기
            </Link>
          </section>
        ) : (
          <>
            {unassignedCount > 0 ? (
              <button
                type="button"
                aria-pressed={filterUnassigned}
                className={`min-h-11 rounded-xl px-3 py-2 text-left text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                  filterUnassigned
                    ? "bg-brand text-white"
                    : "bg-amber-50 text-amber-900 ring-1 ring-amber-200"
                }`}
                onClick={() => setFilterUnassigned((v) => !v)}
              >
                {filterUnassigned
                  ? "전체 보기"
                  : `여행 없는 알림 ${unassignedCount}건만 보기`}
              </button>
            ) : null}

            {noTrips && unassignedCount > 0 ? (
              <section className="rounded-2xl bg-amber-50 px-4 py-3 ring-1 ring-amber-200">
                <p className="text-sm font-extrabold text-amber-950">
                  여행이 없어서 알림 {unassignedCount}건을 보관 중이에요
                </p>
                <p className="mt-1 text-sm text-amber-900">
                  여행을 만들면 기간이 맞는 알림이 자동으로 붙어요.
                </p>
                <button
                  type="button"
                  className="mt-2 inline-flex min-h-11 items-center rounded-xl bg-surface-white px-3 text-sm font-bold text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  onClick={() => setSheetOpen(true)}
                >
                  여행 만들기
                </button>
              </section>
            ) : null}

            {error ? (
              <div
                role="alert"
                className="rounded-lg bg-danger/10 px-3 py-3 text-sm font-semibold text-danger"
              >
                <p>{error}</p>
                <button
                  type="button"
                  disabled={reloadBusy}
                  aria-busy={reloadBusy || undefined}
                  className="mt-2 inline-flex min-h-11 items-center font-bold text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60"
                  onClick={() => {
                    setReloadBusy(true);
                    void load().finally(() => setReloadBusy(false));
                  }}
                >
                  {reloadBusy ? "불러오는 중…" : "다시 불러오기"}
                </button>
              </div>
            ) : null}

            {offlineHint && events.length === 0 ? (
              <p role="status" className="text-sm text-ink-body">
                인터넷 연결을 확인해 주세요.
              </p>
            ) : null}

            {loading ? (
              <div
                role="status"
                aria-label="불러오는 중"
                className="h-40 animate-pulse rounded-2xl bg-surface-soft motion-reduce:animate-none"
              />
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
                      className="flex min-h-11 items-center justify-between text-sm font-extrabold text-ink-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
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

                {!error && groups.scoped.length === 0 ? (
                  <div className="rounded-2xl bg-surface-soft p-6 text-center text-sm leading-relaxed text-ink-body">
                    <p className="font-extrabold text-ink-heading">
                      아직 받은 알림이 없어요
                    </p>
                    <p className="mt-2">
                      {connected
                        ? "연결은 됐어요. 알림이 오면 여기에 나타나요."
                        : "카드 알림 자동 기록을 연결하면 결제 알림이 여기에 모여요."}
                    </p>
                    <Link
                      href={connectHref}
                      className="ai-gradient-bg mt-4 inline-flex min-h-11 items-center justify-center rounded-2xl px-5 text-sm font-bold text-surface-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      {connected ? "연결 상태 확인" : "자동 기록 연결하기"}
                    </Link>
                    {!connected ? (
                      <Link
                        href="/onboarding/shortcut-guide"
                        className="mt-3 block text-sm font-semibold text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                      >
                        연동 가이드 보기
                      </Link>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
          </>
        )}
      </div>

      <QuickTripSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onCreated={onTripCreated}
        reason="inbox"
      />
    </MobileShell>
  );
}
