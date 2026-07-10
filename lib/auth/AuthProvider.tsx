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

interface AuthContextValue {
  isReady: boolean;
  isLoggedIn: boolean;
  user: AuthUser | null;
  provider: AuthProviderKind;
  /** Supabase 카카오 OAuth 시작. 오류 메시지 반환 */
  loginWithKakao: () => Promise<string | null>;
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

    const redirectTo = `${window.location.origin}/auth/callback`;
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
      loginAsGuest,
      logout,
    }),
    [isReady, user, isGuest, provider, loginWithKakao, loginAsGuest, logout]
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
