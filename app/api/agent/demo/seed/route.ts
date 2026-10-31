import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import {
  DEMO_COMPANION_NAMES,
  DEMO_TRIP_COUNTRY,
  DEMO_TRIP_DESTINATION,
  DEMO_TRIP_MEMO_TAG,
  demoDateRangeLabel,
  demoTripDates,
} from "@/lib/demo/scenario";
import { apiInternalError } from "@/lib/api/respond";
import { TABLES } from "@/lib/constants";
import {
  addTripMember,
  ensureOwnerMember,
  listMembers,
} from "@/lib/ledger/supabase";
import { guardApi } from "@/lib/security/guard";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createServerSupabase } from "@/lib/supabase/server";
import { resolveDestinationImage } from "@/lib/trips/destination-image";
import { insertTripToSupabase } from "@/lib/trips/supabase";
import type { Trip } from "@/lib/trips/types";

export const maxDuration = 30;

async function findDemoTrip(
  supabase: SupabaseClient,
  userId: string
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from(TABLES.trips)
    .select("id, destination, memo")
    .eq("user_id", userId)
    .eq("destination", DEMO_TRIP_DESTINATION)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error || !data) return null;
  const hit = data.find(
    (row) =>
      typeof row.memo === "string" && row.memo.includes(DEMO_TRIP_MEMO_TAG)
  );
  return hit ? { id: hit.id as string } : null;
}

export async function POST(request: Request) {
  const guard = await guardApi(request, { bucket: "ledger-parse" });
  if (guard instanceof NextResponse) return guard;
  if (guard.identity.kind !== "user") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

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

  const supabase = await createServerSupabase();

  let tripId: string;
  const existing = await findDemoTrip(supabase, userId);
  if (existing) {
    tripId = existing.id;
  } else {
    const dates = demoTripDates();
    const trip: Trip = {
      id: crypto.randomUUID(),
      destination: DEMO_TRIP_DESTINATION,
      country: DEMO_TRIP_COUNTRY,
      origin: "서울",
      dateRange: demoDateRangeLabel(dates),
      dDay: 0,
      budget: 0,
      spent: 0,
      people: 3,
      styles: [],
      imageUrl: resolveDestinationImage("오사카", DEMO_TRIP_COUNTRY),
      memo: `${DEMO_TRIP_MEMO_TAG} 데모 데이터 — 실제 카드 알림이 아니에요.`,
      expenses: [],
      status: "ongoing",
    };
    const saved = await insertTripToSupabase(supabase, userId, trip);
    if (!saved) {
      return apiInternalError(new Error("demo-trip-insert-failed"));
    }
    tripId = saved.id;
    await ensureOwnerMember(supabase, tripId, userId, "나");
    for (const name of DEMO_COMPANION_NAMES) {
      await addTripMember(supabase, tripId, name);
    }
  }

  const members = await listMembers(supabase, tripId);
  if (members.length < 3) {
    const names = new Set(members.map((m) => m.displayName));
    for (const name of DEMO_COMPANION_NAMES) {
      if (!names.has(name)) {
        await addTripMember(supabase, tripId, name);
      }
    }
  }

  const refreshed = await listMembers(supabase, tripId);
  return NextResponse.json({
    tripId,
    memberIds: refreshed.map((m) => m.id),
    reused: Boolean(existing),
  });
}
