import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAgentAdmin } from "@/lib/agent/admin";
import { readJsonLimited } from "@/lib/agent/body-limit";
import { TABLES } from "@/lib/constants";
import {
  SplitChatSendBodySchema,
  type SplitPreviewPayload,
} from "@/lib/ledger/split-chat";
import {
  ensureSplitThread,
  insertAgentSplitMessage,
  insertUserSplitMessage,
  listSplitChatMessages,
} from "@/lib/ledger/split-chat-server";
import {
  applySplitPatch,
  guestMayApply,
  patchKinds,
  sharesDigest,
  splitPatchReasonMessage,
} from "@/lib/ledger/split-patch";
import {
  findRequesterMember,
  interpretSplitPatch,
  loadSplitContext,
  resolveLatestExpenseId,
} from "@/lib/ledger/split-patch-server";
import { redactSms } from "@/lib/ledger/sms/parse";
import { guardApi } from "@/lib/security/guard";
import { isAnonymousUserIdentity } from "@/lib/security/identity";
import { createServerSupabase } from "@/lib/supabase/server";

export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

async function requireTripMember(
  tripId: string,
  userId: string
): Promise<
  | { ok: true; supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabase>>> }
  | { ok: false; response: NextResponse }
> {
  if (!z.string().uuid().safeParse(tripId).success) {
    return {
      ok: false,
      response: NextResponse.json({ error: "bad-trip" }, { status: 400 }),
    };
  }
  const supabase = await createServerSupabase();
  if (!supabase) {
    return {
      ok: false,
      response: NextResponse.json({ error: "no-supabase" }, { status: 503 }),
    };
  }
  const { data: member } = await supabase
    .from(TABLES.tripMembers)
    .select("id")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!member) {
    return {
      ok: false,
      response: NextResponse.json({ error: "forbidden" }, { status: 403 }),
    };
  }
  return { ok: true, supabase };
}

/** 스레드 ensure + 최근 메시지 */
export async function GET(request: Request, ctx: Ctx) {
  const guard = await guardApi(request, { bucket: "ledger-parse" });
  if (guard instanceof NextResponse) return guard;
  const { identity } = guard;
  if (identity.kind !== "user") {
    return NextResponse.json({ error: "login-required" }, { status: 401 });
  }

  const { id: tripId } = await ctx.params;
  const gate = await requireTripMember(tripId, identity.userId);
  if (!gate.ok) return gate.response;

  const ensured = await ensureSplitThread(gate.supabase, tripId);
  if (!ensured.ok) {
    return NextResponse.json({ error: ensured.error }, { status: 500 });
  }

  const messages = await listSplitChatMessages(
    gate.supabase,
    ensured.threadId
  );
  return NextResponse.json({
    ok: true,
    threadId: ensured.threadId,
    messages,
  });
}

/**
 * 사용자 메시지 저장 → Gemini 해석 → applySplitPatch 미리보기 → agent 카드.
 * 분담 반영은 confirm 에서만.
 */
export async function POST(request: Request, ctx: Ctx) {
  const guard = await guardApi(request, { bucket: "ledger-parse" });
  if (guard instanceof NextResponse) return guard;
  const { identity } = guard;
  if (identity.kind !== "user") {
    return NextResponse.json({ error: "login-required" }, { status: 401 });
  }

  const { id: tripId } = await ctx.params;
  const gate = await requireTripMember(tripId, identity.userId);
  if (!gate.ok) return gate.response;

  const limited = await readJsonLimited(request, 4_096);
  if (!limited.ok) return limited.response;
  const body = SplitChatSendBodySchema.safeParse(limited.json);
  if (!body.success) {
    return NextResponse.json({ error: "invalid-body" }, { status: 400 });
  }

  const ensured = await ensureSplitThread(gate.supabase, tripId);
  if (!ensured.ok) {
    return NextResponse.json({ error: ensured.error }, { status: 500 });
  }

  const attach = body.data.attachment;
  const rawText = body.data.text?.trim() ?? "";
  const redacted = rawText ? redactSms(rawText).trim() : "";

  if (!attach && !redacted) {
    return NextResponse.json({ error: "invalid-body" }, { status: 400 });
  }

  const messageBody = (
    redacted ||
    (attach
      ? attach.kind === "image"
        ? "사진"
        : attach.fileName
      : "")
  ).slice(0, 2000);

  const userMsg = await insertUserSplitMessage(gate.supabase, {
    threadId: ensured.threadId,
    userId: identity.userId,
    body: messageBody,
    payload: attach
      ? {
          type: "attachment",
          kind: attach.kind,
          url: attach.url,
          fileName: attach.fileName,
        }
      : null,
  });
  if (!userMsg) {
    return NextResponse.json({ error: "send-failed" }, { status: 500 });
  }

  const admin = getAgentAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "server-misconfigured" },
      { status: 503 }
    );
  }

  // 첨부만 있으면 공유만. 분담 해석은 텍스트가 있을 때만.
  if (!redacted) {
    const clarify = await insertAgentSplitMessage(admin, {
      threadId: ensured.threadId,
      senderKind: "agent",
      body: "파일을 받았어요. 분담을 바꾸려면 같이 말로 알려 주세요.",
    });
    return NextResponse.json({
      ok: true,
      threadId: ensured.threadId,
      userMessage: userMsg,
      agentMessage: clarify,
    });
  }

  let expenseId = body.data.expenseId;
  if (!expenseId) {
    const latest = await resolveLatestExpenseId(gate.supabase, tripId);
    if (!latest.ok) {
      const clarify = await insertAgentSplitMessage(admin, {
        threadId: ensured.threadId,
        senderKind: "agent",
        body: "나눌 지출을 찾지 못했어요. 지출을 먼저 기록해 주세요.",
      });
      return NextResponse.json({
        ok: true,
        threadId: ensured.threadId,
        userMessage: userMsg,
        agentMessage: clarify,
      });
    }
    expenseId = latest.expenseId;
  }

  const loaded = await loadSplitContext(gate.supabase, expenseId);
  if (!loaded.ok) {
    const clarify = await insertAgentSplitMessage(admin, {
      threadId: ensured.threadId,
      senderKind: "agent",
      body: "그 지출을 불러오지 못했어요. 다시 말해 주실래요?",
    });
    return NextResponse.json({
      ok: true,
      threadId: ensured.threadId,
      userMessage: userMsg,
      agentMessage: clarify,
    });
  }
  const { ctx: splitCtx } = loaded;
  if (splitCtx.tripId !== tripId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const requester = findRequesterMember(splitCtx.members, identity.userId);
  if (!requester) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const ai = await interpretSplitPatch({
    text: redacted,
    ctx: splitCtx,
    userId: identity.userId,
    requesterMemberId: requester.id,
  });

  if (!ai.ok) {
    console.error("[split-chat] interpret", ai.error, ai.reason);
    const clarify = await insertAgentSplitMessage(admin, {
      threadId: ensured.threadId,
      senderKind: "agent",
      body: "지금은 해석하지 못했어요. 조금 더 짧게 다시 말해 주실래요?",
    });
    return NextResponse.json({
      ok: true,
      threadId: ensured.threadId,
      userMessage: userMsg,
      agentMessage: clarify,
    });
  }

  const patch = { ...ai.data, expenseId: splitCtx.expense.id };
  if (patch.clarification && patchKinds(patch).length === 0) {
    const clarify = await insertAgentSplitMessage(admin, {
      threadId: ensured.threadId,
      senderKind: "agent",
      body: patch.clarification,
    });
    return NextResponse.json({
      ok: true,
      threadId: ensured.threadId,
      userMessage: userMsg,
      agentMessage: clarify,
    });
  }

  const applied = applySplitPatch({
    patch,
    expense: splitCtx.expense,
    memberIds: splitCtx.members.map((m) => m.id),
  });
  if (!applied.ok) {
    const clarify = await insertAgentSplitMessage(admin, {
      threadId: ensured.threadId,
      senderKind: "agent",
      body: splitPatchReasonMessage(applied.reason),
    });
    return NextResponse.json({
      ok: true,
      threadId: ensured.threadId,
      userMessage: userMsg,
      agentMessage: clarify,
    });
  }

  const names = new Map(
    splitCtx.members.map((m) => [m.id, m.displayName])
  );
  const rows = (shares: Record<string, number>) =>
    Object.entries(shares)
      .filter(([id]) => names.has(id))
      .map(([memberId, krw]) => ({
        memberId,
        name: names.get(memberId) ?? "",
        krw,
      }));

  const before = rows(splitCtx.expense.shares);
  const after = rows(applied.shares);
  const guestOk = guestMayApply({
    patch,
    requesterMemberId: requester.id,
  });
  const canGuestConfirm = guestOk.ok;

  const summaryParts = after
    .filter((r) => (before.find((b) => b.memberId === r.memberId)?.krw ?? 0) !== r.krw)
    .map((r) => `${r.name} ${r.krw.toLocaleString("ko-KR")}원`);
  const summary =
    summaryParts.length > 0
      ? `이렇게 바꿀까요? ${summaryParts.join(", ")}`
      : "분담이 같게 나와요. 다른 말로 다시 말해 주실래요?";

  const payload: SplitPreviewPayload = {
    type: "split_preview",
    patch,
    beforeDigest: sharesDigest(splitCtx.expense.shares),
    summary,
    idempotencyKey: randomUUID(),
    expenseId: splitCtx.expense.id,
    label: splitCtx.label,
    before,
    after,
    canGuestConfirm,
  };

  const agentMsg = await insertAgentSplitMessage(admin, {
    threadId: ensured.threadId,
    senderKind: "agent",
    body: summary,
    payload,
  });

  return NextResponse.json({
    ok: true,
    threadId: ensured.threadId,
    userMessage: userMsg,
    agentMessage: agentMsg,
    isAnonymous: isAnonymousUserIdentity(identity),
  });
}
