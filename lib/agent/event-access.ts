import "server-only";

import { getAgentAdmin } from "@/lib/agent/admin";

export type AgentEventRecord = {
  id: string;
  user_id: string;
  trip_id: string;
  source: string;
  kind: string;
  payload: Record<string, unknown> | null;
  status: string;
  result: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
  processed_at: string | null;
};

export async function getAgentEventForUser(
  eventId: string,
  userId: string
): Promise<
  | { ok: true; event: AgentEventRecord }
  | { ok: false; status: 404 | 403 | 503; error: string }
> {
  const admin = getAgentAdmin();
  if (!admin) {
    return { ok: false, status: 503, error: "server-misconfigured" };
  }

  const { data, error } = await admin
    .from("agent_events")
    .select(
      "id, user_id, trip_id, source, kind, payload, status, result, error, created_at, processed_at"
    )
    .eq("id", eventId)
    .maybeSingle();

  if (error) {
    return { ok: false, status: 503, error: error.message };
  }
  if (!data) {
    return { ok: false, status: 404, error: "not-found" };
  }
  if (data.user_id !== userId) {
    return { ok: false, status: 403, error: "forbidden" };
  }

  return { ok: true, event: data as AgentEventRecord };
}
