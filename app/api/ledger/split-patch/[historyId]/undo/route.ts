import { NextResponse } from "next/server";
import { z } from "zod";

import { getAgentAdmin } from "@/lib/agent/admin";
import { guardApi } from "@/lib/security/guard";

export const maxDuration = 30;

const HistoryId = z.string().uuid();

type RpcUndoResult = { ok?: boolean; already?: boolean; reason?: string };

/**
 * 되돌리기. 이미 되돌렸으면 변경 없이 성공(멱등).
 * 적용 뒤에 분담이 또 바뀌었으면 409 — 덮어쓰지 않는다.
 * 멤버십은 agent_undo_split_patch RPC 가 p_actor 로 직접 검증한다.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ historyId: string }> }
) {
  const guard = await guardApi(request, { bucket: "ledger-parse" });
  if (guard instanceof NextResponse) return guard;
  const { identity } = guard;
  if (identity.kind !== "user") {
    return NextResponse.json({ error: "login-required" }, { status: 401 });
  }

  const parsedId = HistoryId.safeParse((await params).historyId);
  if (!parsedId.success) {
    return NextResponse.json({ error: "invalid-id" }, { status: 400 });
  }

  const admin = getAgentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "server-misconfigured" }, { status: 503 });
  }

  const { data, error } = await admin.rpc("agent_undo_split_patch", {
    p_actor: identity.userId,
    p_history_id: parsedId.data,
  });
  if (error) {
    const message = error.message ?? "";
    if (/forbidden/.test(message)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (/not-found/.test(message)) {
      return NextResponse.json({ error: "not-found" }, { status: 404 });
    }
    if (/voided/.test(message)) {
      return NextResponse.json({ error: "voided" }, { status: 409 });
    }
    console.error("[split-patch/undo]", message);
    return NextResponse.json({ error: "undo-failed" }, { status: 500 });
  }

  const result = (data ?? {}) as RpcUndoResult;
  if (result.ok !== true) {
    if (result.reason === "conflict") {
      return NextResponse.json(
        {
          error: "conflict",
          message:
            "적용한 뒤에 분담이 또 바뀌어서 되돌릴 수 없어요. 지출에서 직접 고쳐 주세요.",
        },
        { status: 409 }
      );
    }
    console.error("[split-patch/undo] unexpected rpc result");
    return NextResponse.json({ error: "undo-failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, already: Boolean(result.already) });
}
