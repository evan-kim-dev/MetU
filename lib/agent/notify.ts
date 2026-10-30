import "server-only";

import { getAgentAdmin } from "@/lib/agent/admin";
import { pushPayloadForNotification } from "@/lib/push/notify-copy";
import { sendPush } from "@/lib/push/send";

/** Single entry for DB notifications + best-effort web push (P19). */
export async function notifyUsers(args: {
  userIds: string[];
  type: string;
  tripId: string;
  actorId?: string | null;
  payload?: Record<string, unknown>;
  dedupeKey?: string;
}): Promise<void> {
  const admin = getAgentAdmin();
  if (!admin) return;

  const pushes: Array<Promise<unknown>> = [];

  for (const userId of args.userIds) {
    try {
      const { data: notificationId, error } = await admin.rpc("agent_notify", {
        p_user_id: userId,
        p_type: args.type,
        p_trip_id: args.tripId,
        p_actor: args.actorId ?? null,
        p_payload: args.payload ?? {},
        p_dedupe_key: args.dedupeKey ?? null,
      });

      if (error) {
        console.error("[notifyUsers]", error.message);
        continue;
      }

      if (notificationId) {
        const pushPayload = pushPayloadForNotification({
          type: args.type,
          tripId: args.tripId,
          payload: {
            ...(args.payload ?? {}),
            dedupe_key: args.dedupeKey,
          },
          notificationId: String(notificationId),
        });
        pushes.push(sendPush(userId, pushPayload));
      }
    } catch (err) {
      console.error(
        "[notifyUsers]",
        err instanceof Error ? err.message : err
      );
    }
  }

  if (pushes.length > 0) {
    await Promise.allSettled(pushes);
  }
}
