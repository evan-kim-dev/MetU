export const GUEST_COOKIE = "budgettrip-guest";

const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function toBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes.buffer);
}

async function hmacSign(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return toBase64Url(mac);
}

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

/** Mint signed guest cookie value (Edge Web Crypto). */
export async function signGuestCookie(secret: string): Promise<string> {
  const trimmed = secret.trim();
  if (!trimmed) {
    throw new Error("GUEST_COOKIE_SECRET is not configured");
  }
  const issuedAtMs = Date.now();
  const nonce = randomNonce();
  const unsigned = `g1.${issuedAtMs}.${nonce}`;
  const sig = await hmacSign(unsigned, trimmed);
  return `${unsigned}.${sig}`;
}

export async function verifyGuestCookie(
  value: string | undefined,
  secret: string,
  maxAgeMs = DEFAULT_MAX_AGE_MS
): Promise<{ ok: boolean; nonce?: string }> {
  if (!value) return { ok: false };

  const trimmedSecret = secret.trim();
  if (!trimmedSecret) {
    if (process.env.NODE_ENV === "production") {
      return { ok: false };
    }
    if (value === "1") {
      return { ok: true, nonce: "legacy" };
    }
    return { ok: false };
  }

  if (process.env.NODE_ENV !== "production" && value === "1") {
    return { ok: true, nonce: "legacy" };
  }

  const parts = value.split(".");
  if (parts.length !== 4) return { ok: false };
  const [kind, issuedRaw, nonce, sig] = parts;
  if (kind !== "g1" || !issuedRaw || !nonce || !sig) return { ok: false };

  const issuedAtMs = Number(issuedRaw);
  if (!Number.isFinite(issuedAtMs)) return { ok: false };
  if (Date.now() - issuedAtMs > maxAgeMs) return { ok: false };
  if (issuedAtMs > Date.now() + 60_000) return { ok: false };

  const unsigned = `g1.${issuedRaw}.${nonce}`;
  const expected = await hmacSign(unsigned, trimmedSecret);
  if (!timingSafeEqualString(sig, expected)) return { ok: false };

  return { ok: true, nonce };
}
