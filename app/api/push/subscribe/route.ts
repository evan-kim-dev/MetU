import { NextResponse } from "next/server";
import { z } from "zod";

import { readBodyLimited, readJsonLimited } from "@/lib/agent/body-limit";
import { guardApi } from "@/lib/security/guard";
import { createServerSupabase } from "@/lib/supabase/server";

const SubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

const DeleteSchema = z.object({
  endpoint: z.string().url().optional(),
});

export async function POST(request: Request) {
  const guard = await guardApi(request, { bucket: "ledger-parse" });
  if (guard instanceof NextResponse) return guard;
  if (guard.identity.kind !== "user") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await readJsonLimited(request, 8192);
  if (!body.ok) return body.response;

  const parsed = SubscribeSchema.safeParse(body.json);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation-failed" }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const ua = request.headers.get("user-agent")?.slice(0, 512) ?? null;

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: guard.identity.userId,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      user_agent: ua,
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const guard = await guardApi(request, { bucket: "ledger-parse" });
  if (guard instanceof NextResponse) return guard;
  if (guard.identity.kind !== "user") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await readBodyLimited(request, 4096);
  if (!body.ok) return body.response;

  let json: unknown = {};
  if (body.text.trim()) {
    try {
      json = JSON.parse(body.text) as unknown;
    } catch {
      return NextResponse.json({ error: "invalid-json" }, { status: 400 });
    }
  }

  const parsed = DeleteSchema.safeParse(json);
  const supabase = await createServerSupabase();

  let q = supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", guard.identity.userId);

  if (parsed.success && parsed.data.endpoint) {
    q = q.eq("endpoint", parsed.data.endpoint);
  }

  const { error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
