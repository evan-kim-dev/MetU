import { after } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { readJsonLimited } from "@/lib/agent/body-limit";
import {
  buildSmsPayload,
  createEvent,
  defaultSmsIdempotencyKey,
} from "@/lib/agent/ingest";
import { processEvent } from "@/lib/agent/run";
import { requireIngestToken } from "@/lib/agent/tokens";
import { pickTripForAutomationTest } from "@/lib/onboarding/agent-context";

export const maxDuration = 60;

const BodySchema = z.object({
  text: z.string().min(1).max(2000),
  sender: z.string().max(200).optional(),
  receivedAt: z.string().datetime({ offset: true }).optional(),
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

  const { payload, redacted } = buildSmsPayload({
    text: parsed.data.text,
    sender: parsed.data.sender,
    receivedAt: parsed.data.receivedAt,
  });

  const idempotencyKey =
    parsed.data.idempotencyKey ??
    defaultSmsIdempotencyKey(redacted, parsed.data.receivedAt);

  // Token may be user-scoped; attach an active trip if one exists now.
  const tripId =
    auth.tripId ?? (await pickTripForAutomationTest(auth.userId));
  const scopeKey = tripId ?? auth.userId;

  const created = await createEvent({
    userId: auth.userId,
    tripId,
    source: parsed.data.source ?? "sms_shortcut",
    kind: "sms",
    payload,
    idempotencyKey: `${scopeKey}:${idempotencyKey}`,
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

  after(() => {
    void processEvent(created.id);
  });

  return NextResponse.json(
    { eventId: created.id, status: "received" },
    { status: 202 }
  );
}
