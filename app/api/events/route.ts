import { after } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { readJsonLimited } from "@/lib/agent/body-limit";
import {
  buildSmsPayload,
  createEvent,
  defaultSmsIdempotencyKey,
} from "@/lib/agent/ingest";
import { assertTripMember } from "@/lib/agent/membership";
import { processEvent } from "@/lib/agent/run";
import { guardApi } from "@/lib/security/guard";

export const maxDuration = 60;

const BodySchema = z.object({
  tripId: z.string().uuid(),
  kind: z.literal("text"),
  text: z.string().min(1).max(4000),
  source: z.enum(["paste", "share", "manual"]),
  idempotencyKey: z.string().min(8).max(128).optional(),
});

export async function POST(request: Request) {
  const guard = await guardApi(request, { bucket: "ledger-parse" });
  if (guard instanceof NextResponse) return guard;
  if (guard.identity.kind !== "user") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await readJsonLimited(request, 16_384);
  if (!body.ok) return body.response;

  const parsed = BodySchema.safeParse(body.json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation-failed", detail: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const member = await assertTripMember(
    guard.identity.userId,
    parsed.data.tripId
  );
  if (!member) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { payload, redacted } = buildSmsPayload({ text: parsed.data.text });
  const idempotencyKey =
    parsed.data.idempotencyKey ?? defaultSmsIdempotencyKey(redacted);

  const created = await createEvent({
    userId: guard.identity.userId,
    tripId: parsed.data.tripId,
    source: parsed.data.source,
    kind: "text",
    payload,
    idempotencyKey: `${parsed.data.tripId}:${idempotencyKey}`,
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
