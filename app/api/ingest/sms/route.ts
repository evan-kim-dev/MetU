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
    source: z.string().max(40).optional(),
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

  const bodyText = (parsed.data.body ?? parsed.data.text)!.trim();
  const app =
    parsed.data.app?.trim() ||
    parsed.data.sender?.trim() ||
    "iOS 단축어";

  const outcome = await ingestNotificationPayload({
    userId: auth.userId,
    tokenTripId: auth.tripId,
    app,
    title: parsed.data.title ?? "",
    body: bodyText,
    receivedAt,
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
  const message = ingestStatusMessage(outcome.status, duplicate);

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
