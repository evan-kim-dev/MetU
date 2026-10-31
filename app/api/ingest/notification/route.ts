import { NextResponse } from "next/server";
import { z } from "zod";

import { readJsonLimited } from "@/lib/agent/body-limit";
import {
  ingestNotificationPayload,
  scheduleProcessIfNeeded,
} from "@/lib/agent/ingest-notification";
import { ingestStatusMessage } from "@/lib/agent/ingest-source";
import { migrationHintFromError } from "@/lib/agent/sms-text";
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
  source: z.string().max(40).optional(),
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
    source: parsed.data.source,
  });

  if (!outcome.result.ok) {
    const hint = migrationHintFromError(outcome.result.error);
    return NextResponse.json(
      {
        error: outcome.result.error,
        ...(hint ? { hint } : {}),
      },
      { status: 500 }
    );
  }

  const duplicate = outcome.result.duplicate;
  const message = ingestStatusMessage(outcome.status, duplicate, {
    reason: outcome.missReason,
    rule: outcome.matchRule,
  });

  if (duplicate) {
    return NextResponse.json(
      {
        eventId: outcome.result.id,
        duplicate: true,
        status: outcome.status,
        tripId: outcome.tripId,
        message,
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
      message,
    },
    { status: outcome.status === "received" ? 202 : 200 }
  );
}
