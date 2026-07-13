"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { AuthProviderKind, AuthUser } from "@/lib/auth/types";
import { buildKakaoLogoutUrl } from "@/lib/auth/kakao";
import {
  clearGuestSession,
  clearLegacyGuestSession,
  loadGuestSession,
  saveGuestSession,
  syncGuestSession,
} from "@/lib/auth/guest-session";
import {
  clearSupabaseAuthCookies,
  clearSupabaseAuthStorage,
  getBrowserSupabase,
  resetBrowserSupabase,
} from "@/lib/supabase/browser";
import { resolveSiteOrigin } from "@/lib/site-url";

interface AuthContextValue {
  isReady: boolean;
  isLoggedIn: boolean;
  user: AuthUser | null;
  provider: AuthProviderKind;
  /** Supabase 카카오 OAuth 시작. 오류 메시지 반환 */
  loginWithKakao: () => Promise<string | null>;
  /** 이메일/비밀번호 로그인. 오류 메시지 반환, 성공 시 null */
  loginWithEmail: (email: string, password: string) => Promise<string | null>;
  /**
   * 이메일 회원가입.
   * - ok: 바로 로그인됨
   * - confirm_email: 메일 확인 필요
   * - error: 실패
   */
  signUpWithEmail: (
    email: string,
    password: string
  ) => Promise<
    | { status: "ok" }
    | { status: "confirm_email"; message: string }
    | { status: "error"; message: string }
  >;
  loginAsGuest: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const LEGACY_WITHACT_KEY = "budgettrip-auth:withact";

function clearLegacyWithactSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LEGACY_WITHACT_KEY);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    let mounted = true;
    clearLegacyWithactSession();
    clearLegacyGuestSession();

    async function init() {
      const guest = syncGuestSession();
      const supabase = getBrowserSupabase();
      if (!supabase) {
        if (mounted) {
          setIsGuest(guest);
          setIsReady(true);
        }
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      if (data.session?.user) {
        clearGuestSession();
        setUser(data.session.user as AuthUser);
        setIsGuest(false);
      } else {
        setUser(null);
        setIsGuest(guest);
      }
      setIsReady(true);
    }

    void init();

    const supabase = getBrowserSupabase();
    if (!supabase) {
      return () => {
        mounted = false;
      };
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        clearGuestSession();
        setUser(session.user as AuthUser);
        setIsGuest(false);
      } else {
        setUser(null);
        setIsGuest(loadGuestSession());
      }
      setIsReady(true);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const loginWithKakao = useCallback(async () => {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      return "Supabase 환경변수가 없습니다. .env.local 을 확인해 주세요.";
    }

    const redirectTo = `${resolveSiteOrigin(window.location.origin)}/auth/callback`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        redirectTo,
        skipBrowserRedirect: false,
      },
    });

    if (error) return error.message;
    return null;
  }, []);

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      return "Supabase 환경변수가 없습니다. .env.local 을 확인해 주세요.";
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      return "이메일과 비밀번호를 입력해 주세요.";
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });

    if (error) {
      if (error.message.toLowerCase().includes("invalid login")) {
        return "이메일 또는 비밀번호가 올바르지 않아요.";
      }
      if (error.message.toLowerCase().includes("email not confirmed")) {
        return "이메일 인증이 아직 완료되지 않았어요. 메일함을 확인해 주세요.";
      }
      return error.message;
    }

    clearGuestSession();
    return null;
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      return {
        status: "error" as const,
        message: "Supabase 환경변수가 없습니다. .env.local 을 확인해 주세요.",
      };
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      return {
        status: "error" as const,
        message: "이메일과 비밀번호를 입력해 주세요.",
      };
    }
    if (password.length < 6) {
      return {
        status: "error" as const,
        message: "비밀번호는 6자 이상이어야 해요.",
      };
    }

    const redirectTo = `${resolveSiteOrigin(window.location.origin)}/auth/callback`;
    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    if (error) {
      if (error.message.toLowerCase().includes("already registered")) {
        return {
          status: "error" as const,
          message: "이미 가입된 이메일이에요. 로그인해 주세요.",
        };
      }
      return { status: "error" as const, message: error.message };
    }

    if (data.user && !data.session) {
      return {
        status: "confirm_email" as const,
        message:
          "가입은 됐지만 확인 메일이 안 올 수 있어요. Supabase 기본 메일은 팀원 이메일만 받고, 그 외는 Custom SMTP가 필요해요. 당장 쓰려면 Dashboard → Authentication → Providers → Email에서 Confirm email을 끄세요.",
      };
    }

    clearGuestSession();
    return { status: "ok" as const };
  }, []);

  const loginAsGuest = useCallback(() => {
    clearLegacyWithactSession();
    saveGuestSession();
    setIsGuest(true);
    setUser(null);
  }, []);

  const provider: AuthProviderKind = user
    ? user.app_metadata?.provider === "kakao"
      ? "kakao"
      : "supabase"
    : isGuest
      ? "guest"
      : null;

  const logout = useCallback(() => {
    clearGuestSession();
    clearLegacyWithactSession();
    setIsGuest(false);
    setUser(null);

    clearSupabaseAuthStorage();
    clearSupabaseAuthCookies();
    resetBrowserSupabase();

    const serviceLogoutUrl = `${window.location.origin}/auth/logout`;
    const kakaoLogoutUrl = buildKakaoLogoutUrl(serviceLogoutUrl);
    if (kakaoLogoutUrl) {
      window.location.assign(kakaoLogoutUrl);
      return;
    }

    window.location.assign("/auth/logout");
  }, []);

  const value = useMemo(
    () => ({
      isReady,
      isLoggedIn: Boolean(user) || isGuest,
      user,
      provider,
      loginWithKakao,
      loginWithEmail,
      signUpWithEmail,
      loginAsGuest,
      logout,
    }),
    [
      isReady,
      user,
      isGuest,
      provider,
      loginWithKakao,
      loginWithEmail,
      signUpWithEmail,
      loginAsGuest,
      logout,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
