import { after } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAgentAdmin } from "@/lib/agent/admin";
import { readJsonLimited } from "@/lib/agent/body-limit";
import {
  assertTripMember,
  ensureOwnerMemberAdmin,
} from "@/lib/agent/membership";
import { processEvent } from "@/lib/agent/run";
import { guardApi } from "@/lib/security/guard";

export const maxDuration = 60;

const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const BodySchema = z.object({
  tripId: z.string().uuid(),
  /** trips.start_date 가 비어 있을 때만 RPC 가 쓰는 보조 날짜 (KST 달력일) */
  startDate: IsoDate.optional(),
  endDate: IsoDate.optional(),
});

/**
 * Attach unassigned events whose received_at falls in the trip date window,
 * then process them. Tokens stay user-scoped (never bound to a trip).
 */
export async function POST(request: Request) {
  const guard = await guardApi(request, { bucket: "ledger-parse" });
  if (guard instanceof NextResponse) return guard;
  if (guard.identity.kind !== "user") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const limited = await readJsonLimited(request, 4_096);
  if (!limited.ok) return limited.response;

  const parsed = BodySchema.safeParse(limited.json);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation-failed" }, { status: 400 });
  }

  const userId = guard.identity.userId;
  const { tripId, startDate, endDate } = parsed.data;
  const member = await assertTripMember(userId, tripId);
  if (!member) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const admin = getAgentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "server-misconfigured" }, { status: 503 });
  }

  // 본인 trip_members 행을 서버에서 보장 (실패해도 attach 는 계속; processEvent 가 다시 시도).
  await ensureOwnerMemberAdmin(tripId, userId);

  const { data: attachedCount, error } = await admin.rpc(
    "agent_attach_unassigned",
    {
      p_user_id: userId,
      p_trip_id: tripId,
      ...(startDate ? { p_start: startDate } : {}),
      ...(startDate && endDate ? { p_end: endDate } : {}),
    }
  );

  if (error) {
    console.error("[attach-unassigned]", error.message);
    return NextResponse.json({ error: "attach-failed" }, { status: 500 });
  }

  const count = typeof attachedCount === "number" ? attachedCount : 0;

  const requeueIds: string[] = [];
  if (count > 0) {
    const { data: rows } = await admin
      .from("agent_events")
      .select("id")
      .eq("user_id", userId)
      .eq("trip_id", tripId)
      .eq("status", "received")
      .order("created_at", { ascending: true })
      .limit(Math.min(50, Math.max(count, 1)));

    for (const row of rows ?? []) {
      if (typeof row.id === "string") requeueIds.push(row.id);
    }
  }

  if (requeueIds.length > 0) {
    after(async () => {
      for (const id of requeueIds) {
        try {
          await processEvent(id);
        } catch (err) {
          console.error(
            "[attach-unassigned] processEvent",
            id,
            err instanceof Error ? err.message : err
          );
        }
      }
    });
  }

  return NextResponse.json({
    ok: true,
    attached: count,
    requeued: requeueIds.length,
  });
}
