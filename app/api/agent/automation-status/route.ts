import { NextResponse } from "next/server";

import { computeAutomationState } from "@/lib/onboarding/automation";
import {
  loadAgentUserState,
  parseSelectedApps,
  userHasActiveIngestToken,
  userHasActiveTrip,
} from "@/lib/onboarding/agent-context";
import { guardApi } from "@/lib/security/guard";

export const maxDuration = 30;

export async function GET(request: Request) {
  const guard = await guardApi(request, { bucket: "ledger-parse" });
  if (guard instanceof NextResponse) return guard;
  if (guard.identity.kind !== "user") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userId = guard.identity.userId;
  const [row, hasActiveToken, activeTrip] = await Promise.all([
    loadAgentUserState(userId),
    userHasActiveIngestToken(userId),
    userHasActiveTrip(userId),
  ]);

  const status = row?.onboarding_status ?? "pending";
  const silenceHours = Number(process.env.AGENT_SILENCE_HOURS ?? "24");
  const state = computeAutomationState({
    status,
    lastNotificationAt: row?.last_notification_at,
    lastDeviceTestAt: row?.last_device_test_at,
    hasActiveToken,
    activeTrip,
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
  });
}
