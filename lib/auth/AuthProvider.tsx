"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { User } from "@supabase/supabase-js";
import { STORAGE_KEYS } from "@/lib/constants";
import {
  clearSupabaseAuthCookies,
  clearSupabaseAuthStorage,
  getBrowserSupabase,
  resetBrowserSupabase,
} from "@/lib/supabase/browser";
import { buildKakaoLogoutUrl } from "@/lib/auth/kakao";

type AuthProviderKind = "kakao" | "guest" | "supabase" | null;

interface AuthContextValue {
  isReady: boolean;
  isLoggedIn: boolean;
  user: User | null;
  provider: AuthProviderKind;
  /** Start Kakao OAuth (redirects away). Returns error message if any. */
  loginWithKakao: () => Promise<string | null>;
  loginAsGuest: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const GUEST_KEY = STORAGE_KEYS.auth;

function clearGuest() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(GUEST_KEY);
}

function saveGuest() {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    GUEST_KEY,
    JSON.stringify({
      loggedIn: true,
      provider: "guest",
      loggedInAt: new Date().toISOString(),
    })
  );
}

function loadGuest(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { loggedIn?: boolean; provider?: string };
    return Boolean(parsed.loggedIn && parsed.provider === "guest");
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    let mounted = true;

    async function init() {
      const guest = loadGuest();
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
        clearGuest();
        setUser(data.session.user);
        setIsGuest(false);
      } else {
        setUser(null);
        setIsGuest(guest);
      }
      setIsReady(true);
    }

    void init();

    if (!supabase) return () => {
      mounted = false;
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        clearGuest();
        setUser(session.user);
        setIsGuest(false);
      } else {
        setUser(null);
        setIsGuest(loadGuest());
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
    saveGuest();
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
    const shouldUseKakaoLogout = provider === "kakao";

    clearGuest();
    setIsGuest(false);
    setUser(null);
    clearSupabaseAuthStorage();
    clearSupabaseAuthCookies();
    resetBrowserSupabase();

    const serviceLogoutUrl = `${window.location.origin}/auth/logout`;

    if (shouldUseKakaoLogout) {
      const kakaoLogoutUrl = buildKakaoLogoutUrl(serviceLogoutUrl);
      if (kakaoLogoutUrl) {
        window.location.assign(kakaoLogoutUrl);
        return;
      }
    }

    window.location.assign("/auth/logout");
  }, [provider]);

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
