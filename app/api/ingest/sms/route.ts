import { after } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { readJsonLimited } from "@/lib/agent/body-limit";
import {
  buildSmsPayload,
  createEvent,
  defaultSmsIdempotencyKey,
} from "@/lib/agent/ingest";
import {
  ingestNotificationPayload,
  scheduleProcessIfNeeded,
} from "@/lib/agent/ingest-notification";
import { processEvent } from "@/lib/agent/run";
import { requireIngestToken } from "@/lib/agent/tokens";
import { pickTripForReceivedAt } from "@/lib/onboarding/agent-context";

export const maxDuration = 60;

const BodySchema = z
  .object({
    text: z.string().min(1).max(2000).optional(),
    body: z.string().min(1).max(2000).optional(),
    sender: z.string().max(200).optional(),
    app: z.string().max(80).optional(),
    title: z.string().max(200).optional(),
    receivedAt: z.string().datetime({ offset: true }).optional(),
    received_at: z.string().datetime({ offset: true }).optional(),
    idempotencyKey: z.string().min(8).max(128).optional(),
    source: z.enum(["sms_shortcut", "sms_android", "sim"]).optional(),
  })
  .refine((v) => Boolean(v.text?.trim() || v.body?.trim()), {
    message: "text_or_body_required",
    path: ["text"],
  });

export async function POST(request: Request) {
  const auth = await requireIngestToken(request);
  if (auth instanceof NextResponse) return auth;

  const limited = await readJsonLimited(request, 8_192);
  if (!limited.ok) return limited.response;

  const parsed = BodySchema.safeParse(limited.json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation-failed", detail: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const receivedAt =
    parsed.data.receivedAt ??
    parsed.data.received_at ??
    new Date().toISOString();

  // Notification-shaped body → unified notification path.
  if (parsed.data.app && (parsed.data.body || parsed.data.text)) {
    const outcome = await ingestNotificationPayload({
      userId: auth.userId,
      tokenTripId: auth.tripId,
      app: parsed.data.app,
      title: parsed.data.title ?? "",
      body: (parsed.data.body ?? parsed.data.text)!,
      receivedAt,
      idempotencyKey: parsed.data.idempotencyKey,
      source: parsed.data.source ?? "sms_android",
    });
    if (!outcome.result.ok) {
      return NextResponse.json({ error: outcome.result.error }, { status: 500 });
    }
    if (outcome.result.duplicate) {
      return NextResponse.json(
        {
          eventId: outcome.result.id,
          duplicate: true,
          status: outcome.status,
        },
        { status: 200 }
      );
    }
    scheduleProcessIfNeeded(outcome);
    return NextResponse.json(
      {
        eventId: outcome.result.id,
        status: outcome.status,
        tripId: outcome.tripId,
      },
      { status: outcome.status === "received" ? 202 : 200 }
    );
  }

  const text = (parsed.data.text ?? parsed.data.body)!.trim();
  const { payload, redacted } = buildSmsPayload({
    text,
    sender: parsed.data.sender,
    receivedAt,
  });

  const idempotencyKey =
    parsed.data.idempotencyKey ??
    defaultSmsIdempotencyKey(redacted, receivedAt);

  let tripId: string | null = auth.tripId;
  if (!tripId) {
    tripId = await pickTripForReceivedAt(auth.userId, receivedAt);
  }

  const created = await createEvent({
    userId: auth.userId,
    tripId,
    source: parsed.data.source ?? "sms_shortcut",
    kind: "sms",
    payload,
    idempotencyKey: `${auth.userId}:${idempotencyKey}`,
    status: tripId ? "received" : "unassigned",
  });

  if (!created.ok) {
    return NextResponse.json({ error: created.error }, { status: 500 });
  }

  if (created.duplicate) {
    return NextResponse.json(
      { eventId: created.id, duplicate: true },
      { status: 200 }
    );
  }

  if (tripId) {
    after(() => {
      void processEvent(created.id);
    });
    return NextResponse.json(
      { eventId: created.id, status: "received", tripId },
      { status: 202 }
    );
  }

  return NextResponse.json(
    { eventId: created.id, status: "unassigned", tripId: null },
    { status: 200 }
  );
}
