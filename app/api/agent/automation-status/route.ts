import { NextResponse } from "next/server";

import { getAgentAdmin } from "@/lib/agent/admin";
import { computeAutomationState } from "@/lib/onboarding/automation";
import {
  loadAgentUserState,
  parseSelectedApps,
  userHasActiveIngestToken,
  userHasActiveTrip,
} from "@/lib/onboarding/agent-context";
import { guardApi } from "@/lib/security/guard";

export const maxDuration = 30;

type EventRow = {
  id: string;
  status: string;
  created_at: string;
  source: string;
  trip_id: string | null;
  error: string | null;
  payload: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
};

function textPreview(payload: Record<string, unknown> | null): string {
  if (!payload) return "";
  const raw =
    (typeof payload.text === "string" && payload.text) ||
    (typeof payload.body === "string" && payload.body) ||
    "";
  const trimmed = raw.trim().replace(/\s+/g, " ");
  return trimmed.length > 60 ? `${trimmed.slice(0, 60)}…` : trimmed;
}

export async function GET(request: Request) {
  const guard = await guardApi(request, { bucket: "ledger-parse" });
  if (guard instanceof NextResponse) return guard;
  if (guard.identity.kind !== "user") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userId = guard.identity.userId;
  const admin = getAgentAdmin();

  const [row, hasActiveToken, activeTrip] = await Promise.all([
    loadAgentUserState(userId),
    userHasActiveIngestToken(userId),
    userHasActiveTrip(userId),
  ]);

  let recentEvents: Array<{
    id: string;
    status: string;
    createdAt: string;
    source: string;
    tripId: string | null;
    textPreview: string;
    error: string | null;
    reason: string | null;
    preview: {
      amount: number | null;
      currency: string | null;
      merchant: string | null;
      confidence: number;
      kind: string;
    } | null;
  }> = [];
  let unassignedCount = 0;

  if (admin) {
    const { data: events } = await admin
      .from("agent_events")
      .select("id, status, created_at, source, trip_id, error, payload, result")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    recentEvents = ((events ?? []) as EventRow[]).map((e) => {
      const rawPreview = e.result?.preview;
      let preview: (typeof recentEvents)[number]["preview"] = null;
      if (rawPreview && typeof rawPreview === "object" && !Array.isArray(rawPreview)) {
        const p = rawPreview as Record<string, unknown>;
        preview = {
          amount: typeof p.amount === "number" ? p.amount : null,
          currency: typeof p.currency === "string" ? p.currency : null,
          merchant: typeof p.merchant === "string" ? p.merchant : null,
          confidence: typeof p.confidence === "number" ? p.confidence : 0,
          kind: typeof p.kind === "string" ? p.kind : "unknown",
        };
      }
      return {
        id: e.id,
        status: e.status,
        createdAt: e.created_at,
        source: e.source,
        tripId: e.trip_id,
        textPreview: textPreview(e.payload),
        error: e.error,
        reason:
          typeof e.result?.reason === "string" ? e.result.reason : null,
        preview,
      };
    });

    const { count } = await admin
      .from("agent_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "unassigned");
    unassignedCount = count ?? 0;
  }

  const status = row?.onboarding_status ?? "pending";
  const silenceHours = Number(process.env.AGENT_SILENCE_HOURS ?? "24");
  const hasRecentEvent = recentEvents.length > 0;
  const state = computeAutomationState({
    status,
    lastNotificationAt: row?.last_notification_at,
    lastDeviceTestAt: row?.last_device_test_at,
    hasActiveToken,
    activeTrip,
    hasRecentEvent,
    silenceHours: Number.isFinite(silenceHours) ? silenceHours : 24,
  });

  return NextResponse.json({
    status,
    platform: row?.platform ?? null,
    selectedApps: parseSelectedApps(row?.selected_apps),
    lastNotificationAt: row?.last_notification_at ?? null,
    lastDeviceTestAt: row?.last_device_test_at ?? null,
    lastServerTestAt: row?.last_server_test_at ?? null,
    lastDroppedApp: row?.last_dropped_app ?? null,
    state,
    hasActiveToken,
    activeTrip,
    recentEvents,
    unassignedCount,
  });
}
