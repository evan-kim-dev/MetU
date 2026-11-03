import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";

import { readBodyLimited } from "@/lib/agent/body-limit";
import { apiInternalError } from "@/lib/api/respond";
import { TABLES } from "@/lib/constants";
import { isDemoModeEnabled } from "@/lib/demo/mode";
import {
  type DemoScenarioId,
  demoDateRangeLabel,
  demoMeta,
  demoTripDates,
} from "@/lib/demo/scenario";
import {
  addTripMember,
  ensureOwnerMember,
  listMembers,
} from "@/lib/ledger/supabase";
import { guardApi, rejectAnonymousWrite } from "@/lib/security/guard";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createServerSupabase } from "@/lib/supabase/server";
import { resolveDestinationImage } from "@/lib/trips/destination-image";
import { insertTripToSupabase } from "@/lib/trips/supabase";
import type { Trip } from "@/lib/trips/types";

export const maxDuration = 30;

const BodySchema = z.object({
  scenario: z.enum(["osaka", "mingling"]).optional(),
});

async function findDemoTrip(
  supabase: SupabaseClient,
  userId: string,
  scenario: DemoScenarioId
): Promise<{ id: string } | null> {
  const meta = demoMeta(scenario);
  const { data, error } = await supabase
    .from(TABLES.trips)
    .select("id, destination, memo")
    .eq("user_id", userId)
    .eq("destination", meta.destination)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error || !data) return null;
  const hit = data.find(
    (row) =>
      typeof row.memo === "string" && row.memo.includes(meta.memoTag)
  );
  return hit ? { id: hit.id as string } : null;
}

async function parseScenario(request: Request): Promise<
  | { ok: true; scenario: DemoScenarioId }
  | { ok: false; response: NextResponse }
> {
  const body = await readBodyLimited(request, 4_096);
  if (!body.ok) return body;
  if (!body.text.trim()) {
    return { ok: true, scenario: "osaka" };
  }
  let json: unknown;
  try {
    json = JSON.parse(body.text) as unknown;
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "invalid-json" }, { status: 400 }),
    };
  }
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "validation-failed", detail: parsed.error.flatten() },
        { status: 400 }
      ),
    };
  }
  return { ok: true, scenario: parsed.data.scenario ?? "osaka" };
}

export async function POST(request: Request) {
  // 데모 모드가 꺼진 환경에서는 존재하지 않는 라우트처럼 404.
  if (!isDemoModeEnabled()) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }
  const guard = await guardApi(request, { bucket: "ledger-parse" });
  if (guard instanceof NextResponse) return guard;
  if (guard.identity.kind !== "user") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const anon = rejectAnonymousWrite(guard.identity);
  if (anon) return anon;

  const userId = guard.identity.userId;
  const rate = checkRateLimit(`demo-seed:${userId}`, {
    limit: 5,
    windowMs: 60_000,
  });
  if (!rate.ok) {
    return NextResponse.json(
      { error: "rate-limit-exceeded" },
      {
        status: 429,
        headers: rate.retryAfterSec
          ? { "Retry-After": String(rate.retryAfterSec) }
          : undefined,
      }
    );
  }

  const scenarioResult = await parseScenario(request);
  if (!scenarioResult.ok) return scenarioResult.response;
  const scenario = scenarioResult.scenario;
  const meta = demoMeta(scenario);

  const supabase = await createServerSupabase();

  let tripId: string;
  const existing = await findDemoTrip(supabase, userId, scenario);
  if (existing) {
    tripId = existing.id;
  } else {
    const dates = demoTripDates();
    const people = 1 + meta.companions.length;
    const trip: Trip = {
      id: crypto.randomUUID(),
      destination: meta.destination,
      country: meta.country,
      origin: "서울",
      dateRange: demoDateRangeLabel(dates),
      dDay: 0,
      budget: 0,
      spent: 0,
      people,
      styles: [],
      imageUrl: resolveDestinationImage(
        scenario === "mingling" ? "도쿄" : "오사카",
        meta.country
      ),
      memo: `${meta.memoTag} 데모 데이터 — 실제 카드 알림이 아니에요.`,
      expenses: [],
      status: "ongoing",
    };
    const saved = await insertTripToSupabase(supabase, userId, trip);
    if (!saved) {
      return apiInternalError(new Error("demo-trip-insert-failed"));
    }
    tripId = saved.id;
    await ensureOwnerMember(supabase, tripId, userId, "나");
    for (const name of meta.companions) {
      await addTripMember(supabase, tripId, name);
    }
  }

  const members = await listMembers(supabase, tripId);
  const expected = 1 + meta.companions.length;
  if (members.length < expected) {
    const names = new Set(members.map((m) => m.displayName));
    for (const name of meta.companions) {
      if (!names.has(name)) {
        await addTripMember(supabase, tripId, name);
      }
    }
  }

  const refreshed = await listMembers(supabase, tripId);
  return NextResponse.json({
    tripId,
    scenario,
    memberIds: refreshed.map((m) => m.id),
    companions: refreshed
      .filter((m) => !m.isOwner)
      .map((m) => ({
        id: m.id,
        displayName: m.displayName,
        userId: m.userId,
      })),
    reused: Boolean(existing),
  });
}
