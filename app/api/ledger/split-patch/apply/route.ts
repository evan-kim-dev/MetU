import { NextResponse } from "next/server";
import { z } from "zod";

import { getAgentAdmin } from "@/lib/agent/admin";
import { readJsonLimited } from "@/lib/agent/body-limit";
import { TABLES } from "@/lib/constants";
import {
  SplitPatchSchema,
  applySplitPatch,
  patchKinds,
  sharesDigest,
  splitPatchReasonMessage,
} from "@/lib/ledger/split-patch";
import { loadSplitContext } from "@/lib/ledger/split-patch-server";
import { guardApi } from "@/lib/security/guard";
import { createServerSupabase } from "@/lib/supabase/server";

export const maxDuration = 30;

const BodySchema = z.strictObject({
  patch: SplitPatchSchema,
  /** 미리보기 때 서버가 준 beforeDigest. 그 사이 분담이 바뀌었는지 확인하는 용도다. */
  beforeDigest: z.string().max(4_000),
  /** 미리보기마다 클라이언트가 만든 uuid. 같은 키는 한 번만 적용된다. */
  idempotencyKey: z.string().uuid(),
});

type RpcApplyResult = {
  ok?: boolean;
  already?: boolean;
  reason?: string;
  historyId?: string;
};

function rpcErrorResponse(message: string): NextResponse {
  if (/forbidden/.test(message)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (/not-found/.test(message)) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }
  if (/voided/.test(message)) {
    return NextResponse.json({ error: "voided" }, { status: 409 });
  }
  return NextResponse.json({ error: "apply-failed" }, { status: 500 });
}

/**
 * 적용. 클라이언트가 보낸 분담액은 받지 않는다 — patch 만 받아 서버가 다시 계산한다.
 * 쓰기는 agent_apply_split_patch RPC (service_role) 로만 한다.
 */
export async function POST(request: Request) {
  const guard = await guardApi(request, { bucket: "ledger-parse" });
  if (guard instanceof NextResponse) return guard;
  const { identity } = guard;
  if (identity.kind !== "user") {
    return NextResponse.json({ error: "login-required" }, { status: 401 });
  }

  const limited = await readJsonLimited(request, 8_192);
  if (!limited.ok) return limited.response;
  const body = BodySchema.safeParse(limited.json);
  if (!body.success) {
    return NextResponse.json({ error: "invalid-body" }, { status: 400 });
  }
  const { patch, beforeDigest, idempotencyKey } = body.data;

  const supabase = await createServerSupabase();
  const loaded = await loadSplitContext(supabase, patch.expenseId);
  if (!loaded.ok) {
    return loaded.error === "not-found"
      ? NextResponse.json({ error: "forbidden" }, { status: 403 })
      : NextResponse.json({ error: "load-failed" }, { status: 500 });
  }
  const { ctx } = loaded;

  // 재시도: 이미 적용된 키면 분담이 이미 바뀌었으므로 충돌 검사 전에 성공으로 돌려준다.
  const { data: prior } = await supabase
    .from(TABLES.tripExpenseSplitHistory)
    .select("id")
    .eq("expense_id", patch.expenseId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (prior) {
    return NextResponse.json({
      ok: true,
      already: true,
      historyId: String(prior.id),
    });
  }

  if (ctx.status === "voided") {
    return NextResponse.json({ error: "voided" }, { status: 409 });
  }
  if (sharesDigest(ctx.expense.shares) !== beforeDigest) {
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
    expense: ctx.expense,
    memberIds: ctx.members.map((m) => m.id),
  });
  if (!applied.ok) {
    return NextResponse.json(
      { error: applied.reason, message: splitPatchReasonMessage(applied.reason) },
      { status: 422 }
    );
  }

  const admin = getAgentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "server-misconfigured" }, { status: 503 });
  }

  const { data, error } = await admin.rpc("agent_apply_split_patch", {
    p_actor: identity.userId,
    p_expense_id: patch.expenseId,
    p_expected_before: ctx.expense.shares,
    p_split_type: applied.splitType,
    p_shares: applied.shares,
    p_input_values: applied.inputValues,
    p_patch_kind: applied.kind,
    p_idempotency_key: idempotencyKey,
  });
  if (error) {
    console.error("[split-patch/apply]", error.message);
    return rpcErrorResponse(error.message);
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
    console.error("[split-patch/apply] unexpected rpc result");
    return NextResponse.json({ error: "apply-failed" }, { status: 500 });
  }

  console.info(
    JSON.stringify({
      route: "ledger/split-patch/apply",
      kinds: patchKinds(patch),
      already: Boolean(result.already),
    })
  );
  return NextResponse.json({
    ok: true,
    already: Boolean(result.already),
    historyId: result.historyId ?? null,
  });
}
