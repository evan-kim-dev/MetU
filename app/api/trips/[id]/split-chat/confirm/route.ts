import { NextResponse } from "next/server";
import { z } from "zod";

import { getAgentAdmin } from "@/lib/agent/admin";
import { readJsonLimited } from "@/lib/agent/body-limit";
import { TABLES } from "@/lib/constants";
import { SplitChatConfirmBodySchema } from "@/lib/ledger/split-chat";
import {
  ensureSplitThread,
  getSplitMessageById,
  insertAgentSplitMessage,
} from "@/lib/ledger/split-chat-server";
import {
  GUEST_SELF_ONLY_MESSAGE,
  applySplitPatch,
  guestMayApply,
  patchKinds,
  sharesDigest,
  splitPatchReasonMessage,
} from "@/lib/ledger/split-patch";
import {
  findRequesterMember,
  loadSplitContext,
} from "@/lib/ledger/split-patch-server";
import { guardApi } from "@/lib/security/guard";
import { isAnonymousUserIdentity } from "@/lib/security/identity";
import { createServerSupabase } from "@/lib/supabase/server";

export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

type RpcApplyResult = {
  ok?: boolean;
  already?: boolean;
  reason?: string;
  historyId?: string;
};

/**
 * 미리보기 카드 확인 → agent_apply_split_patch + 「반영했어요」 메시지.
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

  const limited = await readJsonLimited(request, 8_192);
  if (!limited.ok) return limited.response;
  const body = SplitChatConfirmBodySchema.safeParse(limited.json);
  if (!body.success) {
    return NextResponse.json({ error: "invalid-body" }, { status: 400 });
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

  const ensured = await ensureSplitThread(supabase, tripId);
  if (!ensured.ok) {
    return NextResponse.json({ error: ensured.error }, { status: 500 });
  }

  const previewMsg = await getSplitMessageById(supabase, body.data.messageId);
  if (
    !previewMsg ||
    previewMsg.threadId !== ensured.threadId ||
    previewMsg.senderKind !== "agent" ||
    previewMsg.payload?.type !== "split_preview"
  ) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }

  const payload = previewMsg.payload;
  if (
    payload.idempotencyKey !== body.data.idempotencyKey ||
    payload.beforeDigest !== body.data.beforeDigest
  ) {
    return NextResponse.json({ error: "invalid-body" }, { status: 400 });
  }

  const patch = payload.patch;
  const loaded = await loadSplitContext(supabase, patch.expenseId);
  if (!loaded.ok) {
    return loaded.error === "not-found"
      ? NextResponse.json({ error: "forbidden" }, { status: 403 })
      : NextResponse.json({ error: "load-failed" }, { status: 500 });
  }
  const { ctx: splitCtx } = loaded;
  if (splitCtx.tripId !== tripId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const requester = findRequesterMember(splitCtx.members, identity.userId);
  if (!requester) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (isAnonymousUserIdentity(identity)) {
    const guest = guestMayApply({
      patch,
      requesterMemberId: requester.id,
    });
    if (!guest.ok) {
      return NextResponse.json(
        { error: guest.code, message: GUEST_SELF_ONLY_MESSAGE },
        { status: 422 }
      );
    }
  }

  const { data: prior } = await supabase
    .from(TABLES.tripExpenseSplitHistory)
    .select("id")
    .eq("expense_id", patch.expenseId)
    .eq("idempotency_key", body.data.idempotencyKey)
    .maybeSingle();

  const admin = getAgentAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "server-misconfigured" },
      { status: 503 }
    );
  }

  if (prior) {
    const alreadyMsg = await insertAgentSplitMessage(admin, {
      threadId: ensured.threadId,
      senderKind: "system",
      body: "이미 반영된 분담이에요.",
    });
    return NextResponse.json({
      ok: true,
      already: true,
      historyId: String(prior.id),
      systemMessage: alreadyMsg,
    });
  }

  if (splitCtx.status === "voided") {
    return NextResponse.json({ error: "voided" }, { status: 409 });
  }
  if (sharesDigest(splitCtx.expense.shares) !== body.data.beforeDigest) {
    return NextResponse.json(
      {
        error: "conflict",
        message: "그 사이 분담이 바뀌었어요. 다시 미리보기를 확인해 주세요.",
      },
      { status: 409 }
    );
  }

  const applied = applySplitPatch({
    patch,
    expense: splitCtx.expense,
    memberIds: splitCtx.members.map((m) => m.id),
  });
  if (!applied.ok) {
    return NextResponse.json(
      {
        error: applied.reason,
        message: splitPatchReasonMessage(applied.reason),
      },
      { status: 422 }
    );
  }

  const { data, error } = await admin.rpc("agent_apply_split_patch", {
    p_actor: identity.userId,
    p_expense_id: patch.expenseId,
    p_expected_before: splitCtx.expense.shares,
    p_split_type: applied.splitType,
    p_shares: applied.shares,
    p_input_values: applied.inputValues,
    p_patch_kind: applied.kind,
    p_idempotency_key: body.data.idempotencyKey,
  });
  if (error) {
    console.error("[split-chat/confirm]", error.message);
    if (/forbidden/.test(error.message)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (/not-found/.test(error.message)) {
      return NextResponse.json({ error: "not-found" }, { status: 404 });
    }
    if (/voided/.test(error.message)) {
      return NextResponse.json({ error: "voided" }, { status: 409 });
    }
    return NextResponse.json({ error: "apply-failed" }, { status: 500 });
  }

  const result = (data ?? {}) as RpcApplyResult;
  if (result.ok !== true) {
    if (result.reason === "conflict") {
      return NextResponse.json(
        {
          error: "conflict",
          message: "그 사이 분담이 바뀌었어요. 다시 미리보기를 확인해 주세요.",
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "apply-failed" }, { status: 500 });
  }

  const systemMsg = await insertAgentSplitMessage(admin, {
    threadId: ensured.threadId,
    senderKind: "system",
    body: result.already
      ? "이미 반영된 분담이에요."
      : `「${payload.label}」 분담을 반영했어요.`,
  });

  console.info(
    JSON.stringify({
      route: "trips/split-chat/confirm",
      kinds: patchKinds(patch),
      already: Boolean(result.already),
    })
  );

  return NextResponse.json({
    ok: true,
    already: Boolean(result.already),
    historyId: result.historyId ? String(result.historyId) : null,
    systemMessage: systemMsg,
  });
}
