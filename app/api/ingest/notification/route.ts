import { NextResponse } from "next/server";
import { z } from "zod";

import { readJsonLimited } from "@/lib/agent/body-limit";
import {
  ingestNotificationPayload,
  scheduleProcessIfNeeded,
} from "@/lib/agent/ingest-notification";
import { requireIngestToken } from "@/lib/agent/tokens";

export const maxDuration = 60;

const BodySchema = z.object({
  app: z.string().min(1).max(80),
  title: z.string().max(200).default(""),
  body: z.string().min(1).max(2000),
  received_at: z.string().datetime({ offset: true }).optional(),
  receivedAt: z.string().datetime({ offset: true }).optional(),
  device: z.string().max(80).optional(),
  idempotencyKey: z.string().min(8).max(128).optional(),
  source: z.enum(["sms_shortcut", "sms_android", "sim"]).optional(),
});

export async function POST(request: Request) {
  const auth = await requireIngestToken(request);
  if (auth instanceof NextResponse) return auth;

  const body = await readJsonLimited(request, 8_192);
  if (!body.ok) return body.response;

  const parsed = BodySchema.safeParse(body.json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation-failed", detail: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const receivedAt =
    parsed.data.received_at ?? parsed.data.receivedAt ?? new Date().toISOString();

  const outcome = await ingestNotificationPayload({
    userId: auth.userId,
    tokenTripId: auth.tripId,
    app: parsed.data.app,
    title: parsed.data.title,
    body: parsed.data.body,
    receivedAt,
    device: parsed.data.device,
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

  const statusCode = outcome.status === "received" ? 202 : 200;
  return NextResponse.json(
    {
      eventId: outcome.result.id,
      status: outcome.status,
      tripId: outcome.tripId,
    },
    { status: statusCode }
  );
}
