import { NextResponse } from "next/server";
import { z } from "zod";

import {
  MTU_ONB_COOKIE,
  ONB_COOKIE_MAX_AGE_SEC,
} from "@/lib/onboarding/constants";
import { apiInternalError } from "@/lib/api/respond";
import { guardApi } from "@/lib/security/guard";
import { createServerSupabase } from "@/lib/supabase/server";

export const maxDuration = 30;

const BodySchema = z.object({
  status: z.enum(["done", "partial", "skipped", "pending"]).optional(),
  platform: z.enum(["ios", "android", "desktop", "other"]).optional(),
  selectedApps: z
    .array(z.string().trim().min(1).max(40))
    .max(20)
    .optional(),
});

function withOnbCookie(response: NextResponse, status: string) {
  response.cookies.set(MTU_ONB_COOKIE, status, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: ONB_COOKIE_MAX_AGE_SEC,
  });
  return response;
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

  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation-failed" }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const status = parsed.data.status ?? "pending";
  const { error } = await supabase.rpc("agent_set_onboarding", {
    p_status: status,
    p_platform: parsed.data.platform ?? null,
    p_selected_apps: parsed.data.selectedApps ?? null,
  });

  if (error) {
    return apiInternalError(error.message);
  }

  return withOnbCookie(
    NextResponse.json({ ok: true, status }),
    status
  );
}
