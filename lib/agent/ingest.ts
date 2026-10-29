import "server-only";

import { createHash } from "node:crypto";

import { getAgentAdmin } from "@/lib/agent/admin";
import { redactSms } from "@/lib/ledger/sms/parse";

export type AgentEventSource =
  | "sms_shortcut"
  | "sms_android"
  | "share"
  | "paste"
  | "upload"
  | "manual"
  | "sim"
  | "domain"
  | "cron";

export type AgentEventKind = "sms" | "text" | "image" | "domain";

export function minuteBucketIso(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) {
    const n = new Date();
    n.setSeconds(0, 0);
    return n.toISOString();
  }
  d.setSeconds(0, 0);
  return d.toISOString();
}

export function defaultSmsIdempotencyKey(
  redactedText: string,
  receivedAt?: string | null
): string {
  const bucket = minuteBucketIso(receivedAt);
  return createHash("sha256")
    .update(`${redactedText}|${bucket}`, "utf8")
    .digest("hex");
}

export type CreateEventInput = {
  userId: string;
  /** Null until the user creates/links a trip. */
  tripId: string | null;
  source: AgentEventSource;
  kind: AgentEventKind;
  payload: Record<string, unknown>;
  idempotencyKey: string;
};

export type CreateEventResult =
  | { ok: true; id: string; duplicate: false }
  | { ok: true; id: string; duplicate: true }
  | { ok: false; error: string };

export async function createEvent(
  input: CreateEventInput
): Promise<CreateEventResult> {
  const admin = getAgentAdmin();
  if (!admin) return { ok: false, error: "server-misconfigured" };

  const { data, error } = await admin
    .from("agent_events")
    .insert({
      user_id: input.userId,
      trip_id: input.tripId,
      source: input.source,
      kind: input.kind,
      payload: input.payload,
      idempotency_key: input.idempotencyKey,
      status: "received",
    })
    .select("id")
    .maybeSingle();

  if (!error && data?.id) {
    return { ok: true, id: data.id as string, duplicate: false };
  }

  // Unique violation -> fetch existing
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code: string }).code)
      : "";
  if (code === "23505" || /duplicate|unique/i.test(error?.message ?? "")) {
    const { data: existing } = await admin
      .from("agent_events")
      .select("id")
      .eq("user_id", input.userId)
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();
    if (existing?.id) {
      return { ok: true, id: existing.id as string, duplicate: true };
    }
  }

  return { ok: false, error: error?.message ?? "insert-failed" };
}

export function buildSmsPayload(args: {
  text: string;
  sender?: string;
  receivedAt?: string;
}): { payload: Record<string, unknown>; redacted: string } {
  const redacted = redactSms(args.text);
  const sender =
    typeof args.sender === "string" && args.sender.trim()
      ? redactSms(args.sender.trim()).slice(0, 200)
      : null;
  return {
    redacted,
    payload: {
      text: redacted,
      sender,
      receivedAt: args.receivedAt ?? null,
    },
  };
}
