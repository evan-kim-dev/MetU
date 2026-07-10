import type { AuthProviderKind, AuthUser } from "@/lib/auth/types";

/** 게시판·멧톡 등 커뮤니티 기능 — 카카오/회원 로그인 필요 */
export function requiresCommunityLogin(
  user: AuthUser | null,
  provider: AuthProviderKind
): boolean {
  if (!user) return true;
  return provider === "guest" || provider === null;
}
