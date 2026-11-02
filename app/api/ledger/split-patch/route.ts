import { NextResponse } from "next/server";
import { z } from "zod";

import { readJsonLimited } from "@/lib/agent/body-limit";
import {
  SplitPatchSchema,
  applySplitPatch,
  sharesDigest,
  splitPatchReasonMessage,
  patchKinds,
} from "@/lib/ledger/split-patch";
import {
  SPLIT_PATCH_TEXT_MAX,
  interpretSplitPatch,
  loadSplitContext,
} from "@/lib/ledger/split-patch-server";
import { guardApi } from "@/lib/security/guard";
import { createServerSupabase } from "@/lib/supabase/server";

export const maxDuration = 60;

const BodySchema = z.strictObject({
  expenseId: z.string().uuid(),
  text: z.string().trim().min(1).max(SPLIT_PATCH_TEXT_MAX),
});

/**
 * 미리보기. 변경은 하지 않는다.
 * Gemini 는 구조화된 SplitPatch 만 돌려주고, 분담액은 순수 함수(applySplitPatch)가 서버에서 계산한다.
 * 사용자 원문은 로그에 남기지 않는다 (길이만).
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
  const { expenseId, text } = body.data;

  const supabase = await createServerSupabase();
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

  const result = await interpretSplitPatch({
    text,
    ctx,
    userId: identity.userId,
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

  // 방어적 재검증: 금액 계열 키 등 스키마 밖 값이 섞여 오면 여기서도 거절한다.
  const checked = SplitPatchSchema.safeParse(result.data);
  if (!checked.success) {
    console.error(
      JSON.stringify({ route: "ledger/split-patch", stage: "patch-recheck" })
    );
    return NextResponse.json({ error: "patch-invalid" }, { status: 422 });
  }
  // 어떤 지출인지는 사용자가 골랐다. 모델이 돌려준 expenseId 는 믿지 않고 덮어쓴다.
  const patch = { ...checked.data, expenseId };

  if (patchKinds(patch).length === 0) {
    return NextResponse.json({
      ok: true,
      needsClarification: true,
      message:
        patch.clarification ??
        splitPatchReasonMessage("clarification-needed"),
    });
  }

  const applied = applySplitPatch({
    patch,
    expense: ctx.expense,
    memberIds: ctx.members.map((m) => m.id),
  });
  console.info(
    JSON.stringify({
      route: "ledger/split-patch",
      textLen: text.length,
      kinds: patchKinds(patch),
      ok: applied.ok,
      reason: applied.ok ? undefined : applied.reason,
    })
  );
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

  return NextResponse.json({
    ok: true,
    needsClarification: false,
    patch,
    preview: {
      expenseId,
      label: ctx.label,
      kind: applied.kind,
      splitType: applied.splitType,
      krwAmount: ctx.expense.krwAmount,
      before: rows(ctx.expense.shares),
      after: rows(applied.shares),
      beforeDigest: sharesDigest(ctx.expense.shares),
    },
  });
}
