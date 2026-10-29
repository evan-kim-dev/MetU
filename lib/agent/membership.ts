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
