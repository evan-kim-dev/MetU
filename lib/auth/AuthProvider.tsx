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
import { clearLegacyWithactKeys } from "@/lib/checklist/legacy-cleanup";
import {
  toUserFacingError,
  type UserFacingError,
} from "@/lib/errors/user-message";
import {
  clearSupabaseAuthCookies,
  clearSupabaseAuthStorage,
  getBrowserSupabase,
  resetBrowserSupabase,
} from "@/lib/supabase/browser";
import { resolveSiteOrigin } from "@/lib/site-url";

const AUTH_UNAVAILABLE: UserFacingError = {
  code: "auth-unconfigured",
  message: "지금은 로그인을 사용할 수 없어요. 잠시 뒤 다시 시도해 주세요.",
  retryable: true,
  action: "retry",
};

function warnAuthConfig() {
  if (process.env.NODE_ENV !== "production") {
    console.warn("[auth] Supabase client is not configured");
  }
}

export type SignUpResult =
  | { status: "signed-in" }
  | { status: "confirm-email"; email: string }
  | { status: "error"; error: UserFacingError };

export type AuthActionResult =
  | { ok: true }
  | { ok: false; error: UserFacingError };

interface AuthContextValue {
  isReady: boolean;
  isLoggedIn: boolean;
  user: AuthUser | null;
  provider: AuthProviderKind;
  loginWithKakao: () => Promise<AuthActionResult>;
  loginWithEmail: (email: string, password: string) => Promise<AuthActionResult>;
  signUpWithEmail: (email: string, password: string) => Promise<SignUpResult>;
  resendSignupConfirmation: (email: string) => Promise<AuthActionResult>;
  loginAsGuest: () => Promise<AuthActionResult>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    let mounted = true;
    clearLegacyWithactKeys();
    clearLegacyGuestSession();

    async function init() {
      const guest = await syncGuestSession();
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
        await clearGuestSession();
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
      void (async () => {
        if (session?.user) {
          await clearGuestSession();
          setUser(session.user as AuthUser);
          setIsGuest(false);
        } else {
          setUser(null);
          setIsGuest(loadGuestSession());
        }
        setIsReady(true);
      })();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const loginWithKakao = useCallback(async (): Promise<AuthActionResult> => {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      warnAuthConfig();
      return { ok: false, error: AUTH_UNAVAILABLE };
    }

    const redirectTo = `${resolveSiteOrigin(window.location.origin)}/auth/callback`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        redirectTo,
        skipBrowserRedirect: false,
      },
    });

    if (error) {
      return {
        ok: false,
        error: toUserFacingError({
          source: "supabase-auth",
          message: error.message,
        }),
      };
    }
    return { ok: true };
  }, []);

  const loginWithEmail = useCallback(
    async (email: string, password: string): Promise<AuthActionResult> => {
      const supabase = getBrowserSupabase();
      if (!supabase) {
        warnAuthConfig();
        return { ok: false, error: AUTH_UNAVAILABLE };
      }

      const trimmedEmail = email.trim();
      if (!trimmedEmail || !password) {
        return {
          ok: false,
          error: {
            code: "validation",
            message: "이메일과 비밀번호를 입력해 주세요.",
            retryable: false,
          },
        };
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error) {
        return {
          ok: false,
          error: toUserFacingError({
            source: "supabase-auth",
            message: error.message,
          }),
        };
      }

      await clearGuestSession();
      return { ok: true };
    },
    []
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string): Promise<SignUpResult> => {
      const supabase = getBrowserSupabase();
      if (!supabase) {
        warnAuthConfig();
        return { status: "error", error: AUTH_UNAVAILABLE };
      }

      const trimmedEmail = email.trim();
      if (!trimmedEmail || !password) {
        return {
          status: "error",
          error: {
            code: "validation",
            message: "이메일과 비밀번호를 입력해 주세요.",
            retryable: false,
          },
        };
      }
      if (password.length < 6) {
        return {
          status: "error",
          error: {
            code: "weak-password",
            message: "비밀번호는 6자 이상으로 만들어 주세요.",
            retryable: false,
          },
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
        return {
          status: "error",
          error: toUserFacingError({
            source: "supabase-auth",
            message: error.message,
          }),
        };
      }

      if (data.user && !data.session) {
        return { status: "confirm-email", email: trimmedEmail };
      }

      await clearGuestSession();
      return { status: "signed-in" };
    },
    []
  );

  const resendSignupConfirmation = useCallback(
    async (email: string): Promise<AuthActionResult> => {
      const supabase = getBrowserSupabase();
      if (!supabase) {
        warnAuthConfig();
        return { ok: false, error: AUTH_UNAVAILABLE };
      }

      const trimmedEmail = email.trim();
      if (!trimmedEmail) {
        return {
          ok: false,
          error: {
            code: "validation",
            message: "이메일을 입력해 주세요.",
            retryable: false,
          },
        };
      }

      const redirectTo = `${resolveSiteOrigin(window.location.origin)}/auth/callback`;
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: trimmedEmail,
        options: { emailRedirectTo: redirectTo },
      });

      if (error) {
        return {
          ok: false,
          error: toUserFacingError({
            source: "supabase-auth",
            message: error.message,
          }),
        };
      }

      return { ok: true };
    },
    []
  );

  const loginAsGuest = useCallback(async (): Promise<AuthActionResult> => {
    clearLegacyWithactKeys();
    const saved = await saveGuestSession();
    if (!saved) {
      return {
        ok: false,
        error: {
          code: "guest-failed",
          message:
            "둘러보기를 시작하지 못했어요. 잠시 뒤 다시 시도해 주세요.",
          retryable: true,
          action: "retry",
        },
      };
    }
    setIsGuest(true);
    setUser(null);
    return { ok: true };
  }, []);

  const provider: AuthProviderKind = user
    ? user.app_metadata?.provider === "kakao"
      ? "kakao"
      : "supabase"
    : isGuest
      ? "guest"
      : null;

  const logout = useCallback(() => {
    void (async () => {
      await clearGuestSession();
      clearLegacyWithactKeys();
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
    })();
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
      resendSignupConfirmation,
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
      resendSignupConfirmation,
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
