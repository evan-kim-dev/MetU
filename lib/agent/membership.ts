import "server-only";

import { getAgentAdmin } from "@/lib/agent/admin";
import { createServerSupabase } from "@/lib/supabase/server";

/** True if user owns the trip or is a trip_member. */
export async function assertTripMember(
  userId: string,
  tripId: string
): Promise<boolean> {
  const supabase = await createServerSupabase();
  const { data: trip } = await supabase
    .from("trips")
    .select("id, user_id")
    .eq("id", tripId)
    .maybeSingle();
  if (trip?.user_id === userId) return true;

  const { data: member } = await supabase
    .from("trip_members")
    .select("id")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .maybeSingle();
  if (member) return true;

  // Fallback admin read when RLS blocks (should be rare for own membership)
  const admin = getAgentAdmin();
  if (!admin) return false;
  const { data: adminMember } = await admin
    .from("trip_members")
    .select("id")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(adminMember);
}

export type EnsureOwnerMemberResult =
  | { ok: true; memberId: string }
  | { ok: false; error: string };

/**
 * Server-side guarantee of the actor's own trip_members row (idempotent).
 *
 * The row used to be created only when the ledger screen was opened on the
 * client, so a trip nobody opened failed ingest with `no-owner-member`.
 * Goes through the `agent_ensure_owner_member` security-definer RPC
 * (service_role only; it verifies owner/member itself).
 *
 * - actor owns the trip, row missing  → row is created
 * - actor already a member            → existing row id
 * - actor is neither                  → { ok: false, error: "forbidden" }
 */
export async function ensureOwnerMemberAdmin(
  tripId: string,
  userId: string
): Promise<EnsureOwnerMemberResult> {
  const admin = getAgentAdmin();
  if (!admin) return { ok: false, error: "server-misconfigured" };

  const { data, error } = await admin.rpc("agent_ensure_owner_member", {
    p_actor: userId,
    p_trip_id: tripId,
  });
  if (error) {
    const message = error.message ?? "ensure-owner-member-failed";
    if (!/forbidden/.test(message)) {
      console.error("[ensureOwnerMemberAdmin]", message);
    }
    return {
      ok: false,
      error: /forbidden/.test(message) ? "forbidden" : "ensure-failed",
    };
  }
  if (typeof data !== "string" || !data) {
    return { ok: false, error: "ensure-failed" };
  }
  return { ok: true, memberId: data };
}
