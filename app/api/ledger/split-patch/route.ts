import { NextResponse } from "next/server";
import { z } from "zod";

import { readJsonLimited } from "@/lib/agent/body-limit";
import {
  GUEST_SELF_ONLY_MESSAGE,
  SplitPatchSchema,
  applySplitPatch,
  chipToPatch,
  currentParticipants,
  guestMayApply,
  sharesDigest,
  splitPatchReasonMessage,
  patchKinds,
  type SplitPatch,
} from "@/lib/ledger/split-patch";
import {
  SPLIT_PATCH_TEXT_MAX,
  findRequesterMember,
  interpretSplitPatch,
  loadSplitContext,
  resolveLatestExpenseId,
  type SplitContext,
} from "@/lib/ledger/split-patch-server";
import { guardApi } from "@/lib/security/guard";
import { isAnonymousUserIdentity } from "@/lib/security/identity";
import { createServerSupabase } from "@/lib/supabase/server";

export const maxDuration = 60;

const TextBodySchema = z
  .strictObject({
    expenseId: z.string().uuid().optional(),
    tripId: z.string().uuid().optional(),
    text: z.string().trim().min(1).max(SPLIT_PATCH_TEXT_MAX),
  })
  .superRefine((body, ctx) => {
    if (!body.expenseId && !body.tripId) {
      ctx.addIssue({
        code: "custom",
        message: "expenseId 또는 tripId 가 필요해요.",
      });
    }
  });

const ChipBodySchema = z.strictObject({
  expenseId: z.string().uuid(),
  chip: z.strictObject({
    memberId: z.string().trim().min(1).max(64),
    action: z.enum(["exclude", "include"]),
  }),
});

function previewJson(args: {
  patch: SplitPatch;
  ctx: SplitContext;
  requesterId: string;
}) {
  const { patch, ctx, requesterId } = args;
  const applied = applySplitPatch({
    patch,
    expense: ctx.expense,
    memberIds: ctx.members.map((m) => m.id),
  });
  if (!applied.ok) {
    return NextResponse.json(
      { error: applied.reason, message: splitPatchReasonMessage(applied.reason) },
      { status: 422 }
    );
  }

  const names = new Map(ctx.members.map((m) => [m.id, m.displayName]));
  const rows = (shares: Record<string, number>) =>
    Object.entries(shares)
      .filter(([id]) => names.has(id))
      .map(([memberId, krw]) => ({
        memberId,
        name: names.get(memberId) ?? "",
        krw,
      }));

  const beforeRows = rows(ctx.expense.shares);
  const afterRows = rows(applied.shares);
  return NextResponse.json({
    ok: true,
    needsClarification: false,
    patch,
    preview: {
      expenseId: patch.expenseId,
      label: ctx.label,
      kind: applied.kind,
      splitType: applied.splitType,
      krwAmount: ctx.expense.krwAmount,
      before: beforeRows,
      after: afterRows,
      beforeDigest: sharesDigest(ctx.expense.shares),
      myBefore: beforeRows.find((r) => r.memberId === requesterId)?.krw ?? 0,
      myAfter: afterRows.find((r) => r.memberId === requesterId)?.krw ?? 0,
      requesterMemberId: requesterId,
    },
    target: { expenseId: patch.expenseId, label: ctx.label },
  });
}

/**
 * 미리보기. 변경은 하지 않는다.
 * 텍스트는 Gemini → SplitPatch, 칩은 chipToPatch(LLM 없음). 분담액은 순수 함수가 계산한다.
 */
export async function POST(request: Request) {
  const guard = await guardApi(request, { bucket: "ledger-parse" });
  if (guard instanceof NextResponse) return guard;
  const { identity } = guard;
  if (identity.kind !== "user") {
    return NextResponse.json({ error: "login-required" }, { status: 401 });
  }

  const limited = await readJsonLimited(request, 4_096);
  if (!limited.ok) return limited.response;

  const chipBody = ChipBodySchema.safeParse(limited.json);
  const textBody = chipBody.success
    ? null
    : TextBodySchema.safeParse(limited.json);
  if (!chipBody.success && !textBody?.success) {
    return NextResponse.json({ error: "invalid-body" }, { status: 400 });
  }

  const supabase = await createServerSupabase();

  let expenseId: string;
  if (chipBody.success) {
    expenseId = chipBody.data.expenseId;
  } else if (textBody?.success) {
    const data = textBody.data;
    expenseId = data.expenseId ?? "";
    if (!expenseId) {
      const tripId = data.tripId;
      if (!tripId) {
        return NextResponse.json({ error: "invalid-body" }, { status: 400 });
      }
      const latest = await resolveLatestExpenseId(supabase, tripId);
      if (!latest.ok) {
        return latest.error === "not-found"
          ? NextResponse.json({ error: "no-expense" }, { status: 404 })
          : NextResponse.json({ error: "load-failed" }, { status: 500 });
      }
      expenseId = latest.expenseId;
    }
  } else {
    return NextResponse.json({ error: "invalid-body" }, { status: 400 });
  }

  const loaded = await loadSplitContext(supabase, expenseId);
  if (!loaded.ok) {
    return loaded.error === "not-found"
      ? NextResponse.json({ error: "forbidden" }, { status: 403 })
      : NextResponse.json({ error: "load-failed" }, { status: 500 });
  }
  const { ctx } = loaded;
  if (ctx.status === "voided") {
    return NextResponse.json({ error: "voided" }, { status: 409 });
  }

  const requester = findRequesterMember(ctx.members, identity.userId);
  if (!requester) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let patch: SplitPatch;

  if (chipBody.success) {
    const built = chipToPatch({
      expenseId,
      memberId: chipBody.data.chip.memberId,
      action: chipBody.data.chip.action,
      currentParticipants: currentParticipants(
        ctx.expense.shares,
        ctx.members.map((m) => m.id)
      ),
    });
    if (!built.ok) {
      return NextResponse.json(
        {
          error: built.reason,
          message: splitPatchReasonMessage(built.reason),
        },
        { status: 422 }
      );
    }
    patch = built.patch;
    console.info(
      JSON.stringify({
        route: "ledger/split-patch",
        path: "chip",
        action: chipBody.data.chip.action,
        kinds: patchKinds(patch),
      })
    );
  } else {
    if (!textBody?.success) {
      return NextResponse.json({ error: "invalid-body" }, { status: 400 });
    }
    const text = textBody.data.text;
    const result = await interpretSplitPatch({
      text,
      ctx,
      userId: identity.userId,
      requesterMemberId: requester.id,
    });

    if (!result.ok) {
      console.error(
        JSON.stringify({
          route: "ledger/split-patch",
          stage: "gemini",
          error: result.error,
          textLen: text.length,
        })
      );
      switch (result.error) {
        case "no_api_key":
          return NextResponse.json({ error: "ai-unavailable" }, { status: 503 });
        case "daily_llm_cap":
          return NextResponse.json({ error: "ai-daily-limit" }, { status: 429 });
        case "zod_failed":
        case "invalid_json":
          return NextResponse.json({ error: "patch-invalid" }, { status: 422 });
        default:
          return NextResponse.json({ error: "ai-failed" }, { status: 502 });
      }
    }

    const checked = SplitPatchSchema.safeParse(result.data);
    if (!checked.success) {
      console.error(
        JSON.stringify({ route: "ledger/split-patch", stage: "patch-recheck" })
      );
      return NextResponse.json({ error: "patch-invalid" }, { status: 422 });
    }
    patch = { ...checked.data, expenseId };

    if (patchKinds(patch).length === 0) {
      return NextResponse.json({
        ok: true,
        needsClarification: true,
        message:
          patch.clarification ??
          splitPatchReasonMessage("clarification-needed"),
        target: { expenseId, label: ctx.label },
      });
    }

    console.info(
      JSON.stringify({
        route: "ledger/split-patch",
        path: "text",
        textLen: text.length,
        kinds: patchKinds(patch),
      })
    );
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

  return previewJson({ patch, ctx, requesterId: requester.id });
}
