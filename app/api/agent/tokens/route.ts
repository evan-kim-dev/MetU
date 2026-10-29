import { NextResponse } from "next/server";
import { z } from "zod";

import { getAgentAdmin } from "@/lib/agent/admin";
import { assertTripMember } from "@/lib/agent/membership";
import {
  hashIngestToken,
  issueTokenPlaintext,
} from "@/lib/agent/tokens";
import { guardApi } from "@/lib/security/guard";

export const maxDuration = 60;

const CreateSchema = z.object({
  tripId: z.string().uuid().optional().nullable(),
  label: z.string().max(80).default(""),
});

export async function GET(request: Request) {
  const guard = await guardApi(request, { bucket: "ledger-parse" });
  if (guard instanceof NextResponse) return guard;
  if (guard.identity.kind !== "user") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const tripIdRaw = url.searchParams.get("tripId");
  const tripId =
    tripIdRaw && z.string().uuid().safeParse(tripIdRaw).success
      ? tripIdRaw
      : null;

  if (tripId) {
    const member = await assertTripMember(guard.identity.userId, tripId);
    if (!member) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  const admin = getAgentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "server-misconfigured" }, { status: 503 });
  }

  let query = admin
    .from("agent_ingest_tokens")
    .select("id, label, trip_id, created_at, last_used_at, revoked_at")
    .eq("user_id", guard.identity.userId)
    .order("created_at", { ascending: false });

  if (tripId) {
    query = query.eq("trip_id", tripId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    tokens: (data ?? []).map((t) => ({
      id: t.id,
      label: t.label,
      tripId: (t.trip_id as string | null) ?? null,
      createdAt: t.created_at,
      lastUsedAt: t.last_used_at,
      revoked: Boolean(t.revoked_at),
    })),
  });
}

export async function POST(request: Request) {
  const guard = await guardApi(request, { bucket: "ledger-parse" });
  if (guard instanceof NextResponse) return guard;
  if (guard.identity.kind !== "user") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 });
  }

  const parsed = CreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation-failed" }, { status: 400 });
  }

  const tripId = parsed.data.tripId ?? null;
  if (tripId) {
    const member = await assertTripMember(guard.identity.userId, tripId);
    if (!member) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  const admin = getAgentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "server-misconfigured" }, { status: 503 });
  }

  let plain: string;
  let tokenHash: string;
  try {
    plain = issueTokenPlaintext();
    tokenHash = hashIngestToken(plain);
  } catch {
    return NextResponse.json({ error: "server-misconfigured" }, { status: 503 });
  }

  const { data, error } = await admin
    .from("agent_ingest_tokens")
    .insert({
      user_id: guard.identity.userId,
      trip_id: tripId,
      label: parsed.data.label || "",
      token_hash: tokenHash,
    })
    .select("id, created_at")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "insert-failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    id: data.id,
    createdAt: data.created_at,
    tripId,
    token: plain,
    warning: "이 토큰은 다시 볼 수 없어요. 지금 복사해 두세요.",
  });
}
