import { NextResponse } from "next/server";
import { GUEST_COOKIE, signGuestCookie } from "@/lib/auth/guest-cookie";
import { resolveGuestCookieSecret } from "@/lib/security/guest-secret";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
};

export async function POST() {
  const secret = resolveGuestCookieSecret();
  if (!secret) {
    return NextResponse.json(
      { error: "guest-secret-missing" },
      { status: 503 }
    );
  }

  try {
    const token = await signGuestCookie(secret);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(GUEST_COOKIE, token, COOKIE_OPTS);
    return res;
  } catch {
    return NextResponse.json(
      { error: "guest-secret-missing" },
      { status: 503 }
    );
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(GUEST_COOKIE, "", {
    ...COOKIE_OPTS,
    maxAge: 0,
  });
  return res;
}
