/** Supabase User 와 호환되는 최소 인증 사용자 */
interface AuthUserMetadata {
  name?: string;
  full_name?: string;
  nickname?: string;
  avatar_url?: string;
  picture?: string;
  [key: string]: unknown;
}

export interface AuthUser {
  id: string;
  email?: string | null;
  user_metadata?: AuthUserMetadata;
  app_metadata?: { provider?: string };
  /** Supabase 익명 로그인. 없으면 false 취급. */
  is_anonymous?: boolean;
}

export type AuthProviderKind = "kakao" | "guest" | "supabase" | null;
