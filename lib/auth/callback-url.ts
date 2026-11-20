import { safeNextPath } from "@/lib/security/safe-next";
import { resolveSiteOrigin } from "@/lib/site-url";

/** 비밀번호 재설정 메일·복구 세션이 도착하는 화면. */
export const UPDATE_PASSWORD_PATH = "/update-password";

/**
 * OAuth / 매직링크 / 재설정 메일의 redirectTo.
 * `next` 가 없거나 `/` 이면 쿼리 없이 `/auth/callback` 만 반환해요.
 */
export function buildAuthCallbackUrl(
  origin: string,
  next?: string | null
): string {
  const base = `${resolveSiteOrigin(origin)}/auth/callback`;
  const path = safeNextPath(next ?? null, "/");
  if (path === "/") return base;
  return `${base}?next=${encodeURIComponent(path)}`;
}
