"use client";

import { useCallback } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { UserFacingError } from "@/lib/errors/user-message";
import { toUserFacingError } from "@/lib/errors/user-message";

export type AuthOk = { ok: true };
export type AuthFail = { ok: false; error: UserFacingError };

export type SignUpActionResult =
  | { ok: true; status: "signed-in" }
  | { ok: true; status: "confirm-email"; email: string }
  | AuthFail;

async function wrap<T extends AuthOk | AuthFail>(
  fn: () => Promise<T>
): Promise<T | AuthFail> {
  try {
    return await fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : undefined;
    return {
      ok: false,
      error: toUserFacingError({ source: "network", message }),
    };
  }
}

export function useAuthActions() {
  const {
    loginWithKakao,
    loginWithEmail,
    signUpWithEmail,
    resendSignupConfirmation,
    loginAsGuest,
  } = useAuth();

  const signInWithKakao = useCallback(async (): Promise<AuthOk | AuthFail> => {
    return wrap(async () => {
      const result = await loginWithKakao();
      if (!result.ok) return result;
      return { ok: true };
    });
  }, [loginWithKakao]);

  const signInWithEmail = useCallback(
    async (email: string, password: string): Promise<AuthOk | AuthFail> => {
      return wrap(async () => {
        const result = await loginWithEmail(email, password);
        if (!result.ok) return result;
        return { ok: true };
      });
    },
    [loginWithEmail]
  );

  const signUpWithEmailAction = useCallback(
    async (email: string, password: string): Promise<SignUpActionResult> => {
      return wrap(async () => {
        const result = await signUpWithEmail(email, password);
        if (result.status === "error") {
          return { ok: false, error: result.error };
        }
        if (result.status === "confirm-email") {
          return {
            ok: true,
            status: "confirm-email",
            email: result.email,
          };
        }
        return { ok: true, status: "signed-in" };
      }) as Promise<SignUpActionResult>;
    },
    [signUpWithEmail]
  );

  const resendConfirmation = useCallback(
    async (email: string): Promise<AuthOk | AuthFail> => {
      return wrap(async () => {
        const result = await resendSignupConfirmation(email);
        if (!result.ok) return result;
        return { ok: true };
      });
    },
    [resendSignupConfirmation]
  );

  const continueAsGuest = useCallback(async (): Promise<AuthOk | AuthFail> => {
    return wrap(async () => {
      const result = await loginAsGuest();
      if (!result.ok) return result;
      return { ok: true };
    });
  }, [loginAsGuest]);

  return {
    signInWithKakao,
    signInWithEmail,
    signUpWithEmail: signUpWithEmailAction,
    resendConfirmation,
    continueAsGuest,
  };
}
