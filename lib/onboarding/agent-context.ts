import "server-only";

import { getAgentAdmin } from "@/lib/agent/admin";
import type { OnboardingStatus } from "@/lib/onboarding/automation";

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

/** Latest non-completed trip for test events (owner or member). */
export async function pickTripForAutomationTest(
  userId: string
): Promise<string | null> {
  const admin = getAgentAdmin();
  if (!admin) return null;

  const { data: owned } = await admin
    .from("trips")
    .select("id")
    .eq("user_id", userId)
    .neq("status", "completed")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (owned?.id) return owned.id as string;

  const { data: memberships } = await admin
    .from("trip_members")
    .select("trip_id")
    .eq("user_id", userId)
    .limit(50);

  const ids = (memberships ?? []).map((m) => m.trip_id as string);
  if (ids.length === 0) return null;

  const { data: trip } = await admin
    .from("trips")
    .select("id")
    .in("id", ids)
    .neq("status", "completed")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (trip?.id as string) ?? null;
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
 * Bind user-scoped tokens/events to a newly available trip.
 * Safe to call repeatedly (only updates null trip_id rows).
 */
export async function bindOrphanAgentRowsToTrip(
  userId: string,
  tripId: string
): Promise<{ tokens: number; events: number }> {
  const admin = getAgentAdmin();
  if (!admin) return { tokens: 0, events: 0 };

  const { data: tokens } = await admin
    .from("agent_ingest_tokens")
    .update({ trip_id: tripId })
    .eq("user_id", userId)
    .is("trip_id", null)
    .is("revoked_at", null)
    .select("id");

  const { data: events } = await admin
    .from("agent_events")
    .update({ trip_id: tripId })
    .eq("user_id", userId)
    .is("trip_id", null)
    .select("id");

  return {
    tokens: tokens?.length ?? 0,
    events: events?.length ?? 0,
  };
}
