import "server-only";

import { getAgentAdmin } from "@/lib/agent/admin";
import { computeTripSettlementBasis } from "@/lib/agent/handlers/settlement";
import { mergeAdjustedIntoSchedule } from "@/lib/agent/suggestion-schedule";
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

function mapRpcError(message: string): string {
  if (message.includes("not-found")) return "not-found";
  if (message.includes("not-open")) return "not-open";
  if (message.includes("forbidden")) return "host-only";
  if (message.includes("wrong-type")) return "wrong-type";
  if (message.includes("has_paid")) return "has-paid";
  return "rpc-failed";
}

/**
 * 호스트가 Suggestion 수락.
 * settle/rebalance 는 agent_accept_* RPC 한 트랜잭션.
 * record 는 confirmEventReviews 후 mark accepted.
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

  const { data: peek } = await admin
    .from(TABLES.tripSuggestions)
    .select("id, trip_id, type, status, payload")
    .eq("id", args.suggestionId)
    .eq("trip_id", args.tripId)
    .maybeSingle();

  if (!peek) return { ok: false, error: "not-found" };
  const suggestion = peek as SuggestionRow;
  if (suggestion.status !== "open") {
    return { ok: false, error: "not-open" };
  }

  const payload =
    suggestion.payload && typeof suggestion.payload === "object"
      ? suggestion.payload
      : {};

  if (suggestion.type === "settle") {
    const basisPayload = await computeTripSettlementBasis(args.tripId);
    if (!basisPayload || basisPayload.transfers.length === 0) {
      return { ok: false, error: "basis-unavailable" };
    }
    const { data, error } = await admin.rpc("agent_accept_settle_suggestion", {
      p_actor: args.actorUserId,
      p_suggestion_id: args.suggestionId,
      p_basis_hash: basisPayload.basis,
      p_transfers: basisPayload.transfers,
    });
    if (error) {
      console.error("[acceptSuggestion] settle", error.message);
      return { ok: false, error: mapRpcError(error.message) };
    }
    return {
      ok: true,
      type: "settle",
      settlementId: data ? String(data) : null,
    };
  }

  if (suggestion.type === "rebalance") {
    const adjusted = asPlanItems(payload.adjustedItems);
    if (!adjusted) {
      return { ok: false, error: "bad-rebalance-payload" };
    }
    const nextSchedule = mergeAdjustedIntoSchedule(
      trip.daily_schedule,
      adjusted
    );
    const { error } = await admin.rpc("agent_accept_rebalance_suggestion", {
      p_actor: args.actorUserId,
      p_suggestion_id: args.suggestionId,
      p_daily_schedule: nextSchedule,
    });
    if (error) {
      console.error("[acceptSuggestion] rebalance", error.message);
      return { ok: false, error: mapRpcError(error.message) };
    }
    return { ok: true, type: "rebalance" };
  }

  if (suggestion.type === "record") {
    const eventId =
      typeof payload.eventId === "string" ? payload.eventId : null;
    const sourceIndex =
      typeof payload.sourceIndex === "number" &&
      Number.isInteger(payload.sourceIndex)
        ? payload.sourceIndex
        : 0;
    if (!eventId) {
      return { ok: false, error: "bad-record-payload" };
    }
    const mergeInto =
      typeof payload.mergeInto === "string" ? payload.mergeInto : null;
    const { confirmEventReviews } = await import("@/lib/agent/run");
    const outcome = await confirmEventReviews(eventId, args.actorUserId, {
      items: [{ index: sourceIndex }],
      mode: mergeInto ? "merge" : "separate",
    });
    if (!outcome.ok) {
      return { ok: false, error: outcome.error };
    }
    const { error } = await admin.rpc("agent_mark_suggestion_accepted", {
      p_actor: args.actorUserId,
      p_suggestion_id: args.suggestionId,
    });
    if (error) {
      console.error("[acceptSuggestion] mark record", error.message);
      // 지출은 이미 확정됨 — status 실패는 로그만
    }
    return { ok: true, type: "record" };
  }

  return { ok: false, error: "unknown-type" };
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

  const { data: peek } = await admin
    .from(TABLES.tripSuggestions)
    .select("id, type, status")
    .eq("id", args.suggestionId)
    .eq("trip_id", args.tripId)
    .maybeSingle();

  if (!peek) return { ok: false, error: "not-found" };
  if (String(peek.status) !== "open") {
    return { ok: false, error: "not-open" };
  }

  const { error } = await admin.rpc("agent_dismiss_suggestion", {
    p_actor: args.actorUserId,
    p_suggestion_id: args.suggestionId,
  });
  if (error) {
    console.error("[dismissSuggestion]", error.message);
    return { ok: false, error: mapRpcError(error.message) };
  }
  return { ok: true, type: String(peek.type) };
}
