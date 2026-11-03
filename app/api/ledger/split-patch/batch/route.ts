import { NextResponse } from "next/server";
import { z } from "zod";

import { readJsonLimited } from "@/lib/agent/body-limit";
import {
  GUEST_SELF_ONLY_MESSAGE,
  SPLIT_PATCH_TEXT_MAX,
  applySplitPatch,
  guestMayApply,
  sharesDigest,
  splitPatchReasonMessage,
  type SplitPatch,
} from "@/lib/ledger/split-patch";
import {
  findRequesterMember,
  interpretBatchSplitPatch,
  loadBatchExpenses,
} from "@/lib/ledger/split-patch-server";
import { guardApi } from "@/lib/security/guard";
import { isAnonymousUserIdentity } from "@/lib/security/identity";
import { createServerSupabase } from "@/lib/supabase/server";

export const maxDuration = 60;

const BodySchema = z.strictObject({
  tripId: z.string().uuid(),
  text: z.string().trim().min(1).max(SPLIT_PATCH_TEXT_MAX),
});

type PreviewRow = {
  patch: SplitPatch;
  preview: {
    expenseId: string;
    label: string;
    kind: string;
    splitType: string;
    krwAmount: number;
    before: Array<{ memberId: string; name: string; krw: number }>;
    after: Array<{ memberId: string; name: string; krw: number }>;
    beforeDigest: string;
    myBefore: number;
    myAfter: number;
    requesterMemberId: string;
  };
};

/**
 * 여러 지출 자연어 분담 미리보기 (K7c). 적용은 클라이언트가 기존 apply 를 건별로 호출.
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
  const body = BodySchema.safeParse(limited.json);
  if (!body.success) {
    return NextResponse.json({ error: "invalid-body" }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const loaded = await loadBatchExpenses(supabase, body.data.tripId);
  if (!loaded.ok) {
    return loaded.error === "not-found"
      ? NextResponse.json({ error: "not-found" }, { status: 404 })
      : NextResponse.json({ error: "load-failed" }, { status: 500 });
  }

  const requester = findRequesterMember(loaded.members, identity.userId);
  if (!requester) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const interpreted = await interpretBatchSplitPatch({
    text: body.data.text,
    tripId: body.data.tripId,
    expenses: loaded.expenses,
    members: loaded.members,
    requesterMemberId: requester.id,
    userId: identity.userId,
  });

  if (!interpreted.ok) {
    return NextResponse.json(
      {
        ok: false,
        needsClarification: true,
        clarification:
          interpreted.clarification ??
          "요청을 정확히 이해하지 못했어요. 조금 더 자세히 적어 주세요.",
        error: interpreted.error,
      },
      { status: 200 }
    );
  }

  const { batch } = interpreted;
  if (batch.patches.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        needsClarification: true,
        clarification:
          batch.clarification ??
          "바꿀 지출을 찾지 못했어요. 품목이나 이름을 더 알려 주세요.",
      },
      { status: 200 }
    );
  }

  const anonymous = isAnonymousUserIdentity(identity);
  const nameMap = new Map(loaded.members.map((m) => [m.id, m.displayName]));
  const rows = (shares: Record<string, number>) =>
    Object.entries(shares)
      .filter(([id]) => nameMap.has(id))
      .map(([memberId, krw]) => ({
        memberId,
        name: nameMap.get(memberId) ?? "",
        krw,
      }));

  const previews: PreviewRow[] = [];
  for (const patch of batch.patches) {
    if (anonymous) {
      const gate = guestMayApply({
        patch,
        requesterMemberId: requester.id,
      });
      if (!gate.ok) {
        return NextResponse.json(
          { error: "guest-self-only", message: GUEST_SELF_ONLY_MESSAGE },
          { status: 422 }
        );
      }
    }

    const ctx = loaded.expenses.find((e) => e.expenseId === patch.expenseId);
    if (!ctx) {
      return NextResponse.json({ error: "bad-index" }, { status: 422 });
    }

    const applied = applySplitPatch({
      patch,
      expense: ctx.expense,
      memberIds: loaded.members.map((m) => m.id),
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

    const beforeRows = rows(ctx.expense.shares);
    const afterRows = rows(applied.shares);
    previews.push({
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
        myBefore: beforeRows.find((r) => r.memberId === requester.id)?.krw ?? 0,
        myAfter: afterRows.find((r) => r.memberId === requester.id)?.krw ?? 0,
        requesterMemberId: requester.id,
      },
    });
  }

  console.info("[split-patch-batch]", {
    tripId: body.data.tripId,
    textLen: body.data.text.length,
    patchCount: previews.length,
  });

  return NextResponse.json({
    ok: true,
    needsClarification: false,
    clarification: batch.clarification,
    items: previews,
  });
}
