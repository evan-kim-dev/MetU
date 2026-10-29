import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createEvent } from "@/lib/agent/ingest";
import { detectImageMime } from "@/lib/agent/image-magic";
import { assertTripMember } from "@/lib/agent/membership";
import { processEvent } from "@/lib/agent/run";
import { getAgentAdmin } from "@/lib/agent/admin";
import { guardApi } from "@/lib/security/guard";

export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024;

const FieldsSchema = z.object({
  tripId: z.string().uuid(),
  source: z.enum(["upload", "share", "manual"]).default("upload"),
});

export async function POST(request: Request) {
  const guard = await guardApi(request, { bucket: "ledger-vision" });
  if (guard instanceof NextResponse) return guard;
  if (guard.identity.kind !== "user") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const declared = Number(request.headers.get("content-length") ?? "NaN");
  // multipart overhead + 4MB file
  if (Number.isFinite(declared) && declared > MAX_BYTES + 256_000) {
    return NextResponse.json({ error: "payload-too-large" }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid-form" }, { status: 400 });
  }

  const fields = FieldsSchema.safeParse({
    tripId: form.get("tripId"),
    source: form.get("source") || "upload",
  });
  if (!fields.success) {
    return NextResponse.json({ error: "validation-failed" }, { status: 400 });
  }

  const member = await assertTripMember(
    guard.identity.userId,
    fields.data.tripId
  );
  if (!member) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file-required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "payload-too-large" }, { status: 413 });
  }

  const buf = new Uint8Array(await file.arrayBuffer());
  const mime = detectImageMime(buf);
  if (!mime) {
    return NextResponse.json({ error: "unsupported-image" }, { status: 400 });
  }

  const admin = getAgentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "server-misconfigured" }, { status: 503 });
  }

  const ext =
    mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const path = `${guard.identity.userId}/${fields.data.tripId}/${randomUUID()}.${ext}`;

  const { error: upErr } = await admin.storage
    .from("agent-uploads")
    .upload(path, buf, { contentType: mime, upsert: false });

  if (upErr) {
    return NextResponse.json(
      { error: "upload-failed", detail: upErr.message },
      { status: 500 }
    );
  }

  const idempotencyKey = `upload:${path}`;
  const created = await createEvent({
    userId: guard.identity.userId,
    tripId: fields.data.tripId,
    source: fields.data.source,
    kind: "image",
    payload: { path, mime },
    idempotencyKey,
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
    { eventId: created.id, status: "received", path },
    { status: 202 }
  );
}
