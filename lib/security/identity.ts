import "server-only";

import { cookies } from "next/headers";
import {
  GUEST_COOKIE,
  verifyGuestCookie,
} from "@/lib/auth/guest-cookie";
import { resolveGuestCookieSecret } from "@/lib/security/guest-secret";
import { createServerSupabase } from "@/lib/supabase/server";

export type RequestIdentity =
  | { kind: "user"; userId: string; isAnonymous?: boolean }
  | { kind: "guest"; nonce: string };

/** Supabase 익명 로그인 사용자(JWT is_anonymous). 쿠키 guest 와는 다름. */
export function isAnonymousUserIdentity(
  identity: RequestIdentity
): boolean {
  return identity.kind === "user" && identity.isAnonymous === true;
}

export async function getRequestIdentity(): Promise<RequestIdentity | null> {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id) {
      return {
        kind: "user",
        userId: user.id,
        isAnonymous: user.is_anonymous === true,
      };
    }
  } catch {
    // fall through to guest cookie
  }

  const cookieStore = await cookies();
  const value = cookieStore.get(GUEST_COOKIE)?.value;
  const secret = resolveGuestCookieSecret();
  const verified = await verifyGuestCookie(value, secret);
  if (verified.ok && verified.nonce) {
    return { kind: "guest", nonce: verified.nonce };
  }

  return null;
}

export function identitySubject(identity: RequestIdentity): string {
  return identity.kind === "user"
    ? identity.userId
    : `guest:${identity.nonce}`;
}
