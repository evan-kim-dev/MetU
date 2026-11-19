import "server-only";

import { getAgentAdmin } from "@/lib/agent/admin";
import { TABLES } from "@/lib/constants";
import type { PlanItem } from "@/lib/budget/types";

export type AcceptSuggestionResult =
  | { ok: true; type: string; settlementId?: string | null }
  | { ok: false; error: string };

type SuggestionRow = {
  id: string;
  trip_id: string;
  type: string;
  status: string;
  payload: Record<string, unknown> | null;
};

function asPlanItems(raw: unknown): PlanItem[] | null {
  if (!Array.isArray(raw)) return null;
  const out: PlanItem[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") return null;
    const r = row as Record<string, unknown>;
    if (
      typeof r.day !== "number" ||
      typeof r.time !== "string" ||
      typeof r.title !== "string" ||
      typeof r.category !== "string" ||
      typeof r.estCost !== "number"
    ) {
      return null;
    }
    out.push({
      tripId: typeof r.tripId === "string" ? r.tripId : "",
      day: r.day,
      time: r.time,
      title: r.title,
      category: r.category as PlanItem["category"],
      estCost: Math.max(0, Math.trunc(r.estCost)),
    });
  }
  return out;
}

/** adjustedItems → trips.daily_schedule 형태 (기존 day 라벨 유지) */
function mergeAdjustedIntoSchedule(
  current: unknown,
  adjusted: PlanItem[]
): unknown {
  const byKey = new Map(
    adjusted.map((i) => [`${i.day}|${i.time}|${i.title}`, i.estCost])
  );
  if (!Array.isArray(current)) {
    const byDay = new Map<number, PlanItem[]>();
    for (const item of adjusted) {
      const list = byDay.get(item.day) ?? [];
      list.push(item);
      byDay.set(item.day, list);
    }
    return [...byDay.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([day, items]) => ({
        day,
        label: `${day}일차`,
        items: items.map((i) => ({
          time: i.time,
          title: i.title,
          cost: i.estCost,
          category: i.category,
        })),
        dayTotal: items.reduce((s, i) => s + i.estCost, 0),
      }));
  }

  return current.map((day) => {
    if (!day || typeof day !== "object") return day;
    const d = day as Record<string, unknown>;
    const dayNum = Number(d.day);
    const items = Array.isArray(d.items) ? d.items : [];
    const nextItems = items.map((it) => {
      if (!it || typeof it !== "object") return it;
      const row = it as Record<string, unknown>;
      const key = `${dayNum}|${String(row.time ?? "")}|${String(row.title ?? "")}`;
      const cost = byKey.get(key);
      if (cost == null) return it;
      return { ...row, cost };
    });
    const dayTotal = nextItems.reduce((s, it) => {
      if (!it || typeof it !== "object") return s;
      const c = (it as { cost?: unknown }).cost;
      return s + (typeof c === "number" ? Math.max(0, Math.trunc(c)) : 0);
    }, 0);
    return { ...d, items: nextItems, dayTotal };
  });
}

/**
 * 호스트가 Suggestion 수락. settle → settlement 스냅샷, rebalance → schedule 패치.
 * record 는 inbox confirm 경로를 쓰고 여기선 status 만 accepted.
 */
export async function acceptSuggestion(args: {
  actorUserId: string;
  tripId: string;
  suggestionId: string;
}): Promise<AcceptSuggestionResult> {
  const admin = getAgentAdmin();
  if (!admin) return { ok: false, error: "server-misconfigured" };

  const { data: trip } = await admin
    .from(TABLES.trips)
    .select("id, user_id, daily_schedule")
    .eq("id", args.tripId)
    .maybeSingle();

  if (!trip || String(trip.user_id) !== args.actorUserId) {
    return { ok: false, error: "host-only" };
  }

  const { data: row } = await admin
    .from(TABLES.tripSuggestions)
    .select("id, trip_id, type, status, payload")
    .eq("id", args.suggestionId)
    .eq("trip_id", args.tripId)
    .maybeSingle();

  if (!row) return { ok: false, error: "not-found" };
  const suggestion = row as SuggestionRow;
  if (suggestion.status !== "open") {
    return { ok: false, error: "not-open" };
  }

  const payload =
    suggestion.payload && typeof suggestion.payload === "object"
      ? suggestion.payload
      : {};

  let settlementId: string | null = null;

  if (suggestion.type === "settle") {
    const basis =
      typeof payload.basisHash === "string" ? payload.basisHash : "";
    const transfers = Array.isArray(payload.transfers)
      ? payload.transfers
      : [];
    if (!basis || transfers.length === 0) {
      return { ok: false, error: "bad-settle-payload" };
    }
    const { data, error } = await admin.rpc("agent_create_settlement", {
      p_actor: args.actorUserId,
      p_trip_id: args.tripId,
      p_mode: "manual",
      p_basis_hash: basis,
      p_transfers: transfers,
    });
    if (error) {
      console.error("[acceptSuggestion] settle", error.message);
      return { ok: false, error: "settle-failed" };
    }
    settlementId = data ? String(data) : null;
  } else if (suggestion.type === "rebalance") {
    const adjusted = asPlanItems(payload.adjustedItems);
    if (!adjusted) {
      return { ok: false, error: "bad-rebalance-payload" };
    }
    const nextSchedule = mergeAdjustedIntoSchedule(
      trip.daily_schedule,
      adjusted
    );
    const { error } = await admin
      .from(TABLES.trips)
      .update({ daily_schedule: nextSchedule })
      .eq("id", args.tripId);
    if (error) {
      console.error("[acceptSuggestion] rebalance", error.message);
      return { ok: false, error: "rebalance-failed" };
    }
  } else if (suggestion.type === "record") {
    // 지출 반영은 confirmEventReviews. 여기선 표시용 status 만.
  } else {
    return { ok: false, error: "unknown-type" };
  }

  const { error: updErr } = await admin
    .from(TABLES.tripSuggestions)
    .update({
      status: "accepted",
      decided_by: args.actorUserId,
      decided_at: new Date().toISOString(),
    })
    .eq("id", args.suggestionId)
    .eq("status", "open");

  if (updErr) {
    console.error("[acceptSuggestion] status", updErr.message);
    return { ok: false, error: "status-failed" };
  }

  return { ok: true, type: suggestion.type, settlementId };
}

export async function dismissSuggestion(args: {
  actorUserId: string;
  tripId: string;
  suggestionId: string;
}): Promise<AcceptSuggestionResult> {
  const admin = getAgentAdmin();
  if (!admin) return { ok: false, error: "server-misconfigured" };

  const { data: trip } = await admin
    .from(TABLES.trips)
    .select("id, user_id")
    .eq("id", args.tripId)
    .maybeSingle();

  if (!trip || String(trip.user_id) !== args.actorUserId) {
    return { ok: false, error: "host-only" };
  }

  const { data: row, error } = await admin
    .from(TABLES.tripSuggestions)
    .update({
      status: "dismissed",
      decided_by: args.actorUserId,
      decided_at: new Date().toISOString(),
    })
    .eq("id", args.suggestionId)
    .eq("trip_id", args.tripId)
    .eq("status", "open")
    .select("id, type")
    .maybeSingle();

  if (error) {
    console.error("[dismissSuggestion]", error.message);
    return { ok: false, error: "update-failed" };
  }
  if (!row) return { ok: false, error: "not-found" };
  return { ok: true, type: String(row.type) };
}
