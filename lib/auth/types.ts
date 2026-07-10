/** Supabase User 와 호환되는 최소 인증 사용자 */
export interface AuthUserMetadata {
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
}

export type AuthProviderKind = "kakao" | "guest" | "supabase" | null;
