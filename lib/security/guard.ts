import "server-only";

import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  getRequestIdentity,
  identitySubject,
  type RequestIdentity,
} from "@/lib/security/identity";
import { checkRateLimit } from "@/lib/security/rate-limit";

// requireIngestToken lives in lib/agent/tokens.ts (P10).

export type GuardBucket =
  | "ai"
  | "enrich-plan"
  | "places"
  | "places/route"
  | "ledger-parse"
  | "ledger-vision";

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

async function sha256HexTruncated(input: string, hexLen = 32): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input)
  );
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i]!.toString(16).padStart(2, "0");
  }
  return hex.slice(0, hexLen);
}

async function buildClientKey(
  identity: RequestIdentity,
  request: Request
): Promise<string> {
  const raw = `${identitySubject(identity)}:${clientIp(request)}`;
  return sha256HexTruncated(raw);
}

function bucketLimits(bucket: GuardBucket): { limit: number; windowMs: number } {
  const windowMs = 60_000;
  switch (bucket) {
    case "ai": {
      const parsed = Number(process.env.AI_RATE_LIMIT_PER_MIN ?? "20");
      const limit = Number.isFinite(parsed) && parsed > 0 ? parsed : 20;
      return { limit, windowMs };
    }
    case "enrich-plan":
      return { limit: 5, windowMs };
    case "places":
    case "places/route":
      return { limit: 30, windowMs };
    case "ledger-parse":
      return { limit: 20, windowMs };
    case "ledger-vision": {
      const parsed = Number(process.env.AI_VISION_RATE_LIMIT_PER_MIN ?? "6");
      const limit = Number.isFinite(parsed) && parsed > 0 ? parsed : 6;
      return { limit, windowMs };
    }
    default:
      return { limit: 20, windowMs };
  }
}

export async function guardApi(
  request: Request,
  options: { bucket: GuardBucket }
): Promise<
  NextResponse | { identity: RequestIdentity; clientKey: string }
> {
  const identity = await getRequestIdentity();
  if (!identity) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const clientKey = await buildClientKey(identity, request);
  const { limit, windowMs } = bucketLimits(options.bucket);
  const rate = checkRateLimit(`${options.bucket}:${clientKey}`, {
    limit,
    windowMs,
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

  return { identity, clientKey };
}

function safeEqualUtf8(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/** Cron / pg_net: Authorization Bearer CRON_SECRET */
export function requireCronSecret(
  request: Request
): NextResponse | { ok: true } {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "server-misconfigured" }, { status: 503 });
  }
  const auth = request.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(\S+)$/i.exec(auth);
  const provided = m?.[1] ?? "";
  if (!safeEqualUtf8(provided, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return { ok: true };
}
