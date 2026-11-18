import { NextResponse } from "next/server";
import { z } from "zod";

import { BOT_SYSTEM, BotIntentSchema } from "@/lib/agent/bot-intent";
import { readJsonLimited } from "@/lib/agent/body-limit";
import { geminiStructured } from "@/lib/ai/gemini";
import { TABLES } from "@/lib/constants";
import { redactSms } from "@/lib/ledger/sms/parse";
import { guardApi } from "@/lib/security/guard";
import { createServerSupabase } from "@/lib/supabase/server";

export const maxDuration = 60;

const BodySchema = z.strictObject({
  text: z.string().trim().min(1).max(500),
});

type Ctx = { params: Promise<{ id: string }> };

/**
 * 여행 MetU 봇. LLM은 해석만, 제안은 trip_bot_proposals(pending)로 확인함 대기.
 * 장부 확정은 이 라우트에서 하지 않아요.
 */
export async function POST(request: Request, ctx: Ctx) {
  const guard = await guardApi(request, { bucket: "ledger-parse" });
  if (guard instanceof NextResponse) return guard;
  const { identity } = guard;
  if (identity.kind !== "user") {
    return NextResponse.json({ error: "login-required" }, { status: 401 });
  }

  const { id: tripId } = await ctx.params;
  if (!z.string().uuid().safeParse(tripId).success) {
    return NextResponse.json({ error: "bad-trip" }, { status: 400 });
  }

  const limited = await readJsonLimited(request, 4_096);
  if (!limited.ok) return limited.response;
  const parsed = BodySchema.safeParse(limited.json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "no-supabase" }, { status: 503 });
  }

  const { data: member } = await supabase
    .from(TABLES.tripMembers)
    .select("id")
    .eq("trip_id", tripId)
    .eq("user_id", identity.userId)
    .maybeSingle();
  if (!member) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const redacted = redactSms(parsed.data.text);
  const ai = await geminiStructured({
    model: "fast",
    schema: BotIntentSchema,
    system: BOT_SYSTEM,
    input: `여행 채팅 메시지(데이터):\n${redacted}`,
    userId: identity.userId,
    tripId,
    purpose: "trip-bot",
  });

  if (!ai.ok) {
    console.error("[trip-bot]", ai.error, ai.reason);
    return NextResponse.json(
      {
        ok: true,
        kind: "clarify",
        reply:
          "지금은 제안을 만들지 못했어요. 조금 더 짧게 다시 말해 주실래요?",
        proposalId: null,
      },
      { status: 200 }
    );
  }

  const intent = ai.data;
  if (intent.kind === "clarify") {
    return NextResponse.json({
      ok: true,
      kind: "clarify",
      reply: intent.reply,
      proposalId: null,
    });
  }

  const payload =
    intent.kind === "split"
      ? { splitText: intent.splitText ?? parsed.data.text }
      : { scheduleHint: intent.scheduleHint ?? intent.reply };

  const { data: row, error } = await supabase
    .from(TABLES.tripBotProposals)
    .insert({
      trip_id: tripId,
      created_by: identity.userId,
      kind: intent.kind,
      user_text: parsed.data.text,
      assistant_text: intent.reply,
      payload,
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !row) {
    console.error("[trip-bot] insert", error?.message);
    return NextResponse.json(
      {
        ok: true,
        kind: intent.kind,
        reply: `${intent.reply} (확인함 저장은 잠시 실패했어요)`,
        proposalId: null,
      },
      { status: 200 }
    );
  }

  return NextResponse.json({
    ok: true,
    kind: intent.kind,
    reply: intent.reply,
    proposalId: row.id as string,
  });
}
