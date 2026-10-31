import "server-only";

import { getAgentAdmin } from "@/lib/agent/admin";
import type { OnboardingStatus } from "@/lib/onboarding/automation";
import {
  buildTripSuggest,
  matchTripForEvent,
  resolveTripDatesForReceivedAt,
  type TripMatchCandidate,
  type TripMatchMissReason,
  type TripMatchRule,
  type TripSuggest,
} from "@/lib/onboarding/trip-match";

export type AgentUserStateRow = {
  onboarding_status: OnboardingStatus;
  platform: string | null;
  selected_apps: unknown;
  last_notification_at: string | null;
  last_device_test_at: string | null;
  last_server_test_at: string | null;
  last_dropped_app: string | null;
};

export function parseSelectedApps(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((v): v is string => typeof v === "string")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
}

export async function loadAgentUserState(
  userId: string
): Promise<AgentUserStateRow | null> {
  const admin = getAgentAdmin();
  if (!admin) return null;

  const { data } = await admin
    .from("agent_user_state")
    .select(
      "onboarding_status, platform, selected_apps, last_notification_at, last_device_test_at, last_server_test_at, last_dropped_app"
    )
    .eq("user_id", userId)
    .maybeSingle();

  return (data as AgentUserStateRow | null) ?? null;
}

export async function userHasActiveIngestToken(userId: string): Promise<boolean> {
  const admin = getAgentAdmin();
  if (!admin) return false;

  const { count } = await admin
    .from("agent_ingest_tokens")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("revoked_at", null);

  return (count ?? 0) > 0;
}

export async function userHasActiveTrip(userId: string): Promise<boolean> {
  const admin = getAgentAdmin();
  if (!admin) return false;

  const { data: owned } = await admin
    .from("trips")
    .select("id")
    .eq("user_id", userId)
    .neq("status", "completed")
    .limit(1);

  if (owned && owned.length > 0) return true;

  const { data: memberships } = await admin
    .from("trip_members")
    .select("trip_id")
    .eq("user_id", userId)
    .limit(20);

  const ids = (memberships ?? []).map((m) => m.trip_id as string);
  if (ids.length === 0) return false;

  const { data: trips } = await admin
    .from("trips")
    .select("id")
    .in("id", ids)
    .neq("status", "completed")
    .limit(1);

  return Boolean(trips && trips.length > 0);
}

type TripDateRow = {
  id: string;
  start_date: string | null;
  end_date: string | null;
  date_range: string | null;
  destination?: string | null;
  local_currency?: string | null;
  status?: string | null;
  created_at?: string | null;
};

const TRIP_MATCH_COLUMNS =
  "id, start_date, end_date, date_range, destination, local_currency, status, created_at";

function toCandidate(
  row: TripDateRow,
  receivedAtMs: number
): TripMatchCandidate {
  const dates = resolveTripDatesForReceivedAt(
    {
      startDate: row.start_date,
      endDate: row.end_date,
      dateRange: row.date_range,
    },
    receivedAtMs
  );
  const createdMs = row.created_at ? Date.parse(row.created_at) : NaN;
  return {
    id: row.id,
    startDate: dates?.startDate ?? null,
    endDate: dates?.endDate ?? null,
    localCurrency: row.local_currency ?? null,
    createdAtMs: Number.isNaN(createdMs) ? null : createdMs,
    status: row.status ?? null,
    destination: row.destination ?? null,
  };
}

async function listMemberTripDateRows(userId: string): Promise<TripDateRow[]> {
  const admin = getAgentAdmin();
  if (!admin) return [];

  const byId = new Map<string, TripDateRow>();

  const { data: owned } = await admin
    .from("trips")
    .select(TRIP_MATCH_COLUMNS)
    .eq("user_id", userId)
    .neq("status", "completed")
    .limit(50);

  for (const row of owned ?? []) {
    byId.set(row.id as string, row as TripDateRow);
  }

  const { data: memberships } = await admin
    .from("trip_members")
    .select("trip_id")
    .eq("user_id", userId)
    .limit(50);

  const memberIds = (memberships ?? [])
    .map((m) => m.trip_id as string)
    .filter((id) => !byId.has(id));

  if (memberIds.length > 0) {
    const { data: trips } = await admin
      .from("trips")
      .select(TRIP_MATCH_COLUMNS)
      .in("id", memberIds)
      .neq("status", "completed")
      .limit(50);
    for (const row of trips ?? []) {
      byId.set(row.id as string, row as TripDateRow);
    }
  }

  return [...byId.values()];
}

export type TripPick = {
  tripId: string | null;
  rule: TripMatchRule;
  /** rule === "none" 일 때 구체 사유 */
  reason?: TripMatchMissReason;
  /** 수신함 "○○ 여행에 붙이기" 제안 (event.result.suggest 로 저장) */
  suggest?: TripSuggest;
  /** 알림 시각이 창 안(exact)인 여행 id 전부 (수동 배정이 날짜에 맞는지 판단용) */
  exactTripIds?: string[];
};

/**
 * 알림 시각에 맞는 내 여행(소유 + 멤버)을 고른다. 규칙은 lib/onboarding/trip-match.ts.
 * 자동 저장은 rule === "exact" 일 때만 허용된다.
 */
export async function pickTripForReceivedAt(
  userId: string,
  receivedAt: string | Date,
  opts?: { hintCurrency?: string | null; nowMs?: number }
): Promise<TripPick> {
  const ms =
    typeof receivedAt === "string"
      ? Date.parse(receivedAt)
      : receivedAt.getTime();
  if (Number.isNaN(ms)) {
    return { tripId: null, rule: "none", reason: "no_dates" };
  }

  const rows = await listMemberTripDateRows(userId);
  const candidates = rows.map((row) => toCandidate(row, ms));
  const match = matchTripForEvent({
    receivedAtMs: ms,
    nowMs: opts?.nowMs ?? Date.now(),
    candidates,
    hintCurrency: opts?.hintCurrency ?? null,
  });
  const suggest = buildTripSuggest(match, candidates);

  return {
    tripId: match.tripId,
    rule: match.rule,
    ...(match.reason ? { reason: match.reason } : {}),
    ...(suggest ? { suggest } : {}),
    exactTripIds: match.candidates
      .filter((c) => c.rule === "exact")
      .map((c) => c.tripId),
  };
}

export async function touchServerTestAt(userId: string): Promise<void> {
  const admin = getAgentAdmin();
  if (!admin) return;

  const now = new Date().toISOString();
  await admin.from("agent_user_state").upsert(
    {
      user_id: userId,
      last_server_test_at: now,
      updated_at: now,
    },
    { onConflict: "user_id" }
  );
}

/**
 * 폰에서 알림이 도착했음을 기록할 row 를 만든다.
 * - 실제 알림: last_notification_at(+ 마지막 카드 앱)만 갱신.
 * - 연결 테스트(MTU-TEST): last_device_test_at 만 갱신. "실제 알림 수신 시각"을 오염시키지 않는다.
 */
export function buildNotificationTouchRow(
  userId: string,
  app: string,
  opts: { deviceTest?: boolean } | undefined,
  now: string
): Record<string, unknown> {
  if (opts?.deviceTest) {
    return {
      user_id: userId,
      last_device_test_at: now,
      updated_at: now,
    };
  }
  return {
    user_id: userId,
    last_notification_at: now,
    last_dropped_app: app.trim().slice(0, 80) || null,
    updated_at: now,
  };
}

/** Record that a phone notification (or device test) arrived. */
export async function touchNotificationAt(
  userId: string,
  app: string,
  opts?: { deviceTest?: boolean }
): Promise<void> {
  const admin = getAgentAdmin();
  if (!admin) return;

  const row = buildNotificationTouchRow(
    userId,
    app,
    opts,
    new Date().toISOString()
  );
  await admin.from("agent_user_state").upsert(row, { onConflict: "user_id" });
}
