import { NextResponse } from "next/server";
import { z } from "zod";

import { getAgentAdmin } from "@/lib/agent/admin";
import { readJsonLimited } from "@/lib/agent/body-limit";
import { guardApi } from "@/lib/security/guard";

export const maxDuration = 15;

const BodySchema = z.strictObject({
  /** agent-uploads 경로. `${userId}/...` 만 허용 */
  path: z.string().min(3).max(500),
});

/**
 * 영수증 서명 URL. 업로더 본인 경로만. 짧은 만료.
 */
export async function POST(request: Request) {
  const guard = await guardApi(request, { bucket: "ledger-parse" });
  if (guard instanceof NextResponse) return guard;
  if (guard.identity.kind !== "user") {
    return NextResponse.json({ error: "login-required" }, { status: 401 });
  }

  const limited = await readJsonLimited(request, 2_048);
  if (!limited.ok) return limited.response;
  const body = BodySchema.safeParse(limited.json);
  if (!body.success) {
    return NextResponse.json({ error: "invalid-body" }, { status: 400 });
  }

  const path = body.data.path.replace(/^\/+/, "");
  const prefix = `${guard.identity.userId}/`;
  if (!path.startsWith(prefix) || path.includes("..")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const admin = getAgentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "server-misconfigured" }, { status: 503 });
  }

  const { data, error } = await admin.storage
    .from("agent-uploads")
    .createSignedUrl(path, 60);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "sign-failed" }, { status: 500 });
  }

  return NextResponse.json({ url: data.signedUrl, expiresIn: 60 });
}
