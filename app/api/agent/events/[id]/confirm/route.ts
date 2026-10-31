import { NextResponse } from "next/server";
import { z } from "zod";

import { readBodyLimited } from "@/lib/agent/body-limit";
import { getAgentEventForUser } from "@/lib/agent/event-access";
import { confirmEventReviews } from "@/lib/agent/run";
import type { ExpenseDraftInput } from "@/lib/ledger/draft";
import { guardApi } from "@/lib/security/guard";

export const maxDuration = 60;

const IdSchema = z.string().uuid();

const ItemSchema = z.object({
  index: z.number().int().min(0),
  draft: z.record(z.string(), z.unknown()).optional(),
});

const BodySchema = z.object({
  items: z.array(ItemSchema).optional(),
  /** merge: 영수증을 기존 지출에 합치기, separate(기본): 별개로 저장 */
  mode: z.enum(["merge", "separate"]).optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await guardApi(request, { bucket: "ledger-parse" });
  if (guard instanceof NextResponse) return guard;
  if (guard.identity.kind !== "user") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id: eventId } = await context.params;
  if (!IdSchema.safeParse(eventId).success) {
    return NextResponse.json({ error: "bad-id" }, { status: 400 });
  }

  const owned = await getAgentEventForUser(eventId, guard.identity.userId);
  if (!owned.ok) {
    return NextResponse.json({ error: owned.error }, { status: owned.status });
  }

  let parsed: z.infer<typeof BodySchema> = {};
  const limited = await readBodyLimited(request, 65_536);
  if (!limited.ok) return limited.response;
  if (limited.text.trim()) {
    let raw: unknown;
    try {
      raw = JSON.parse(limited.text) as unknown;
    } catch {
      return NextResponse.json({ error: "invalid-json" }, { status: 400 });
    }
    const result = BodySchema.safeParse(raw);
    if (!result.success) {
      return NextResponse.json({ error: "invalid-body" }, { status: 400 });
    }
    parsed = result.data;
  }

  const items = parsed.items?.map((it) => ({
    index: it.index,
    draft: it.draft as ExpenseDraftInput | undefined,
  }));

  const outcome = await confirmEventReviews(
    eventId,
    guard.identity.userId,
    items?.length || parsed.mode
      ? { items, mode: parsed.mode }
      : undefined
  );

  if (!outcome.ok) {
    const status =
      outcome.error === "not-found"
        ? 404
        : outcome.error === "forbidden"
          ? 403
          : outcome.error === "bad-status"
            ? 409
            : 400;
    return NextResponse.json({ error: outcome.error }, { status });
  }

  return NextResponse.json({
    ok: true,
    expenseIds: outcome.expenseIds,
    status: outcome.status,
  });
}
