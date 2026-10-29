import "server-only";

import webpush from "web-push";

import { getAgentAdmin } from "@/lib/agent/admin";

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag?: string;
};

type SubRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

let vapidConfigured = false;

function ensureVapid(): boolean {
  if (vapidConfigured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject =
    process.env.VAPID_SUBJECT?.trim() || "mailto:support@met-u.app";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

function isGoneStatus(code: number | undefined): boolean {
  return code === 404 || code === 410;
}

/** Best-effort web push to all subscriptions for a user; never throws. */
export async function sendPush(
  userId: string,
  payload: PushPayload
): Promise<void> {
  try {
    if (!ensureVapid()) return;

    const admin = getAgentAdmin();
    if (!admin) return;

    const { data, error } = await admin
      .from("push_subscriptions")
      .select("id,endpoint,p256dh,auth")
      .eq("user_id", userId);

    if (error || !data?.length) return;

    const body = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url,
      tag: payload.tag ?? payload.url,
    });

    for (const row of data as SubRow[]) {
      try {
        await webpush.sendNotification(
          {
            endpoint: row.endpoint,
            keys: { p256dh: row.p256dh, auth: row.auth },
          },
          body,
          { TTL: 60 * 60 * 24 }
        );
        await admin
          .from("push_subscriptions")
          .update({ last_ok_at: new Date().toISOString() })
          .eq("id", row.id);
      } catch (err: unknown) {
        const status =
          err && typeof err === "object" && "statusCode" in err
            ? Number((err as { statusCode: number }).statusCode)
            : undefined;
        if (isGoneStatus(status)) {
          await admin.from("push_subscriptions").delete().eq("id", row.id);
        }
      }
    }
  } catch (err) {
    console.error("[sendPush]", err instanceof Error ? err.message : err);
  }
}
