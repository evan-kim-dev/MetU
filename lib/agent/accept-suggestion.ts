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

async function claimOpenSuggestion(args: {
  suggestionId: string;
  tripId: string;
  actorUserId: string;
}): Promise<SuggestionRow | null> {
  const admin = getAgentAdmin();
  if (!admin) return null;
  const decidedAt = new Date().toISOString();
  const { data, error } = await admin
    .from(TABLES.tripSuggestions)
    .update({
      status: "accepted",
      decided_by: args.actorUserId,
      decided_at: decidedAt,
    })
    .eq("id", args.suggestionId)
    .eq("trip_id", args.tripId)
    .eq("status", "open")
    .select("id, trip_id, type, status, payload")
    .maybeSingle();
  if (error) {
    console.error("[claimOpenSuggestion]", error.message);
    return null;
  }
  return data as SuggestionRow | null;
}

async function reopenSuggestion(args: {
  suggestionId: string;
  actorUserId: string;
}): Promise<void> {
  const admin = getAgentAdmin();
  if (!admin) return;
  await admin
    .from(TABLES.tripSuggestions)
    .update({
      status: "open",
      decided_by: null,
      decided_at: null,
    })
    .eq("id", args.suggestionId)
    .eq("status", "accepted")
    .eq("decided_by", args.actorUserId);
}

/**
 * 호스트가 Suggestion 수락.
 * settle: 원장에서 transfers 재계산 후 settlement 스냅샷.
 * rebalance: daily_schedule 패치.
 * record: confirmEventReviews 로 지출 확정.
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
  if (String((peek as SuggestionRow).status) !== "open") {
    return { ok: false, error: "not-open" };
  }

  const claimed = await claimOpenSuggestion({
    suggestionId: args.suggestionId,
    tripId: args.tripId,
    actorUserId: args.actorUserId,
  });
  if (!claimed) {
    return { ok: false, error: "not-open" };
  }

  const payload =
    claimed.payload && typeof claimed.payload === "object"
      ? claimed.payload
      : {};

  let settlementId: string | null = null;

  try {
    if (claimed.type === "settle") {
      const basisPayload = await computeTripSettlementBasis(args.tripId);
      if (!basisPayload || basisPayload.transfers.length === 0) {
        await reopenSuggestion({
          suggestionId: args.suggestionId,
          actorUserId: args.actorUserId,
        });
        return { ok: false, error: "basis-unavailable" };
      }
      const { data, error } = await admin.rpc("agent_create_settlement", {
        p_actor: args.actorUserId,
        p_trip_id: args.tripId,
        p_mode: "manual",
        p_basis_hash: basisPayload.basis,
        p_transfers: basisPayload.transfers,
      });
      if (error) {
        console.error("[acceptSuggestion] settle", error.message);
        await reopenSuggestion({
          suggestionId: args.suggestionId,
          actorUserId: args.actorUserId,
        });
        return { ok: false, error: "settle-failed" };
      }
      settlementId = data ? String(data) : null;
    } else if (claimed.type === "rebalance") {
      const adjusted = asPlanItems(payload.adjustedItems);
      if (!adjusted) {
        await reopenSuggestion({
          suggestionId: args.suggestionId,
          actorUserId: args.actorUserId,
        });
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
        await reopenSuggestion({
          suggestionId: args.suggestionId,
          actorUserId: args.actorUserId,
        });
        return { ok: false, error: "rebalance-failed" };
      }
    } else if (claimed.type === "record") {
      const eventId =
        typeof payload.eventId === "string" ? payload.eventId : null;
      const sourceIndex =
        typeof payload.sourceIndex === "number" &&
        Number.isInteger(payload.sourceIndex)
          ? payload.sourceIndex
          : 0;
      if (!eventId) {
        await reopenSuggestion({
          suggestionId: args.suggestionId,
          actorUserId: args.actorUserId,
        });
        return { ok: false, error: "bad-record-payload" };
      }
      const mergeInto =
        typeof payload.mergeInto === "string" ? payload.mergeInto : null;
      // 동적 import — run.ts ↔ accept 순환 방지
      const { confirmEventReviews } = await import("@/lib/agent/run");
      const outcome = await confirmEventReviews(
        eventId,
        args.actorUserId,
        {
          items: [{ index: sourceIndex }],
          mode: mergeInto ? "merge" : "separate",
        }
      );
      if (!outcome.ok) {
        await reopenSuggestion({
          suggestionId: args.suggestionId,
          actorUserId: args.actorUserId,
        });
        return { ok: false, error: outcome.error };
      }
    } else {
      await reopenSuggestion({
        suggestionId: args.suggestionId,
        actorUserId: args.actorUserId,
      });
      return { ok: false, error: "unknown-type" };
    }
  } catch (err) {
    console.error("[acceptSuggestion]", err);
    await reopenSuggestion({
      suggestionId: args.suggestionId,
      actorUserId: args.actorUserId,
    });
    return { ok: false, error: "accept-failed" };
  }

  return { ok: true, type: claimed.type, settlementId };
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
