import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { getAgentAdmin } from "@/lib/agent/admin";
import { checkRateLimit } from "@/lib/security/rate-limit";

/** Readable ingest token prefix (Crockford base32 body). */
export const TOKEN_PREFIX = "metu-";
/** Legacy prefix kept for already-issued tokens. */
export const LEGACY_TOKEN_PREFIX = "mtu_";

/** Crockford base32 alphabet: no I, L, O, U (avoids 0/O and 1/I/L confusion). */
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function pepper(): string | null {
  const p = process.env.AGENT_INGEST_PEPPER?.trim();
  return p || null;
}

export function hashIngestToken(plain: string): string {
  const p = pepper();
  if (!p) {
    throw new Error("AGENT_INGEST_PEPPER missing");
  }
  return createHash("sha256").update(`${plain}${p}`, "utf8").digest("hex");
}

export async function hashIngestTokenAsync(plain: string): Promise<string> {
  return hashIngestToken(plain);
}

function encodeCrockford16(bytes: Buffer): string {
  if (bytes.length !== 10) {
    throw new Error("crockford-bytes");
  }
  let bits = 0n;
  for (const b of bytes) {
    bits = (bits << 8n) | BigInt(b);
  }
  let out = "";
  for (let i = 15; i >= 0; i--) {
    const idx = Number((bits >> BigInt(i * 5)) & 0x1fn);
    out += CROCKFORD[idx]!;
  }
  return out;
}

/** Issue `metu-XXXX-XXXX-XXXX-XXXX` (16 Crockford chars, grouped by 4). */
export function issueTokenPlaintext(): string {
  const body = encodeCrockford16(randomBytes(10));
  const groups = body.match(/.{1,4}/g) ?? [];
  return `${TOKEN_PREFIX}${groups.join("-")}`;
}

const NEW_TOKEN_RE = /^metu-[0-9A-HJKMNP-TV-Z]{4}(?:-[0-9A-HJKMNP-TV-Z]{4}){3}$/;
const LEGACY_TOKEN_RE = /^mtu_[A-Za-z0-9_-]{16,}$/;

/**
 * Normalize bearer token for hash lookup.
 * - metu-… → trim + uppercase body (prefix forced to metu-)
 * - mtu_… → trim only (base64url is case-sensitive)
 * Returns null if format is invalid.
 */
export function normalizeIngestToken(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  if (lower.startsWith(TOKEN_PREFIX)) {
    const body = trimmed.slice(TOKEN_PREFIX.length).toUpperCase();
    const normalized = `${TOKEN_PREFIX}${body}`;
    if (!NEW_TOKEN_RE.test(normalized)) return null;
    return normalized;
  }

  if (trimmed.startsWith(LEGACY_TOKEN_PREFIX)) {
    if (!LEGACY_TOKEN_RE.test(trimmed) || trimmed.length < 20) return null;
    return trimmed;
  }

  return null;
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export type IngestAuth = {
  userId: string;
  /** Null when the token was issued before a trip existed. */
  tripId: string | null;
  tokenId: string;
};

export async function requireIngestToken(
  request: Request
): Promise<NextResponse | IngestAuth> {
  if (!pepper()) {
    return NextResponse.json({ error: "server-misconfigured" }, { status: 503 });
  }

  const auth = request.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(\S+)$/i.exec(auth);
  const raw = m?.[1] ?? "";
  const plain = normalizeIngestToken(raw);
  if (!plain) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = getAgentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "server-misconfigured" }, { status: 503 });
  }

  let tokenHash: string;
  try {
    tokenHash = hashIngestToken(plain);
  } catch {
    return NextResponse.json({ error: "server-misconfigured" }, { status: 503 });
  }

  const { data, error } = await admin
    .from("agent_ingest_tokens")
    .select("id, user_id, trip_id, revoked_at, token_hash")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (
    error ||
    !data ||
    data.revoked_at ||
    !safeEqualHex(String(data.token_hash), tokenHash)
  ) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const tripId =
    typeof data.trip_id === "string" && data.trip_id.length > 0
      ? (data.trip_id as string)
      : null;

  // Trip-bound tokens: re-check membership (token may outlive membership).
  // User-scoped tokens (trip_id null) skip this — trip is bound later.
  if (tripId) {
    const { data: trip } = await admin
      .from("trips")
      .select("id, user_id")
      .eq("id", tripId)
      .maybeSingle();
    const isOwner = trip?.user_id === data.user_id;
    let isMember = isOwner;
    if (!isMember) {
      const { data: mem } = await admin
        .from("trip_members")
        .select("id")
        .eq("trip_id", tripId)
        .eq("user_id", data.user_id)
        .maybeSingle();
      isMember = Boolean(mem);
    }
    if (!isMember) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const perMin = checkRateLimit(`ingest-token:${data.id}:min`, {
    limit: 30,
    windowMs: 60_000,
  });
  if (!perMin.ok) {
    return NextResponse.json(
      { error: "rate-limit-exceeded" },
      {
        status: 429,
        headers: perMin.retryAfterSec
          ? { "Retry-After": String(perMin.retryAfterSec) }
          : undefined,
      }
    );
  }
  const perDay = checkRateLimit(`ingest-token:${data.id}:day`, {
    limit: 200,
    windowMs: 24 * 60 * 60 * 1000,
  });
  if (!perDay.ok) {
    return NextResponse.json(
      { error: "rate-limit-exceeded" },
      {
        status: 429,
        headers: perDay.retryAfterSec
          ? { "Retry-After": String(perDay.retryAfterSec) }
          : undefined,
      }
    );
  }

  try {
    await admin
      .from("agent_ingest_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", data.id);
  } catch (err) {
    console.error(
      "[requireIngestToken] last_used_at",
      err instanceof Error ? err.message : err
    );
  }

  return {
    userId: data.user_id as string,
    tripId,
    tokenId: data.id as string,
  };
}
