import { NextResponse } from "next/server";
import { z } from "zod";

import { getAgentAdmin } from "@/lib/agent/admin";
import { getAgentEventForUser } from "@/lib/agent/event-access";
import { readJsonLimited } from "@/lib/agent/body-limit";
import { apiInternalError } from "@/lib/api/respond";
import { guardApi, rejectAnonymousWrite } from "@/lib/security/guard";

export const maxDuration = 30;

const IdSchema = z.string().uuid();

const DraftSchema = z
  .object({
    merchant: z.string().trim().min(1).max(120).optional(),
    amount: z.number().positive().max(1e12).optional(),
    currency: z
      .string()
      .trim()
      .length(3)
      .transform((s) => s.toUpperCase())
      .optional(),
    spentOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  })
  .strict();

const BodySchema = z
  .object({
    /** 알림에 보이는 원문/미리보기 텍스트 */
    text: z.string().trim().min(1).max(2000).optional(),
    draft: DraftSchema.optional(),
  })
  .strict()
  .refine((b) => b.text != null || b.draft != null, {
    message: "empty",
  });

const EDITABLE = new Set([
  "needs_review",
  "failed",
  "ignored",
  "unassigned",
  "received",
]);

/**
 * 본인 수신함 알림 내용 수정.
 * text → payload.text, draft → result.items[review] draft 병합.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await guardApi(request, { bucket: "ledger-parse" });
  if (guard instanceof NextResponse) return guard;
  if (guard.identity.kind !== "user") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const anon = rejectAnonymousWrite(guard.identity);
  if (anon) return anon;

  const { id: eventId } = await context.params;
  if (!IdSchema.safeParse(eventId).success) {
    return NextResponse.json({ error: "bad-id" }, { status: 400 });
  }

  const owned = await getAgentEventForUser(eventId, guard.identity.userId);
  if (!owned.ok) {
    return NextResponse.json({ error: owned.error }, { status: owned.status });
  }
  if (!EDITABLE.has(owned.event.status)) {
    return NextResponse.json({ error: "bad-status" }, { status: 409 });
  }

  const limited = await readJsonLimited(request, 8_192);
  if (!limited.ok) return limited.response;
  const body = BodySchema.safeParse(limited.json);
  if (!body.success) {
    return NextResponse.json({ error: "invalid-body" }, { status: 400 });
  }

  const admin = getAgentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "server-misconfigured" }, { status: 503 });
  }

  const patch: Record<string, unknown> = {};
  const prevPayload =
    owned.event.payload && typeof owned.event.payload === "object"
      ? { ...owned.event.payload }
      : {};
  if (body.data.text != null) {
    patch.payload = { ...prevPayload, text: body.data.text };
  }

  if (body.data.draft) {
    const prevResult =
      owned.event.result && typeof owned.event.result === "object"
        ? { ...(owned.event.result as Record<string, unknown>) }
        : {};
    const items = Array.isArray(prevResult.items)
      ? [...(prevResult.items as Array<Record<string, unknown>>)]
      : [];
    let touched = false;
    const nextItems = items.map((it) => {
      if (it.decision !== "review") return it;
      touched = true;
      const prevDraft =
        it.draft && typeof it.draft === "object"
          ? { ...(it.draft as Record<string, unknown>) }
          : {};
      return {
        ...it,
        draft: { ...prevDraft, ...body.data.draft },
      };
    });
    if (!touched) {
      nextItems.push({
        decision: "review",
        draft: body.data.draft,
        reasons: ["사용자가 수정함"],
      });
    }
    patch.result = { ...prevResult, items: nextItems };
    if (owned.event.status === "failed" || owned.event.status === "ignored") {
      patch.status = "needs_review";
    }
  }

  const { error } = await admin
    .from("agent_events")
    .update(patch)
    .eq("id", eventId)
    .eq("user_id", guard.identity.userId);

  if (error) {
    return apiInternalError(error.message);
  }

  return NextResponse.json({ ok: true });
}
