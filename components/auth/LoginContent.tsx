"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { AuthMessage } from "@/components/auth/AuthMessage";
import { EmailAuthForm } from "@/components/auth/EmailAuthForm";
import { LoginWorldHero } from "@/components/auth/LoginWorldHero";
import { useAuthActions } from "@/components/auth/useAuthActions";
import {
  callbackErrorCode,
  callbackErrorToUserFacing,
} from "@/lib/auth/callback-error";
import { safeNextPath } from "@/lib/security/safe-next";
import type { UserFacingError } from "@/lib/errors/user-message";

export function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signInWithKakao } = useAuthActions();

  const [kakaoLoading, setKakaoLoading] = useState(false);
  const [kakaoSlowHint, setKakaoSlowHint] = useState(false);
  const [error, setError] = useState<UserFacingError | null>(null);
  const [postLoginStatus, setPostLoginStatus] = useState<string | null>(null);
  const deleted = searchParams.get("deleted") === "1";
  const slowLoginTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processedQueryError = useRef<string | null>(null);

  const goNext = useCallback(() => {
    router.replace(safeNextPath(searchParams.get("next"), "/"));
  }, [router, searchParams]);

  const startPostLoginStatus = useCallback(() => {
    setPostLoginStatus("로그인했어요. 화면을 불러오는 중이에요…");
    if (slowLoginTimer.current) clearTimeout(slowLoginTimer.current);
    slowLoginTimer.current = setTimeout(() => {
      setPostLoginStatus("조금 오래 걸리고 있어요. 잠시만 기다려 주세요.");
    }, 5000);
  }, []);

  useEffect(() => {
    return () => {
      if (slowLoginTimer.current) clearTimeout(slowLoginTimer.current);
    };
  }, []);

  useEffect(() => {
    const raw = searchParams.get("error");
    if (!raw) {
      processedQueryError.current = null;
      return;
    }
    if (processedQueryError.current === raw) return;
    processedQueryError.current = raw;

    const code = callbackErrorCode(raw);
    setError(callbackErrorToUserFacing(code));

    const next = searchParams.get("next");
    const nextQs = next ? `?next=${encodeURIComponent(next)}` : "";
    router.replace(`/login${nextQs}`);
  }, [searchParams, router]);

  useEffect(() => {
    const clearKakaoLoading = () => {
      setKakaoLoading(false);
      setKakaoSlowHint(false);
    };

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) clearKakaoLoading();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") clearKakaoLoading();
    };

    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    if (!kakaoLoading) {
      setKakaoSlowHint(false);
      return;
    }
    const t = window.setTimeout(() => setKakaoSlowHint(true), 3000);
    return () => window.clearTimeout(t);
  }, [kakaoLoading]);

  const handleKakaoLogin = async () => {
    if (kakaoLoading) return;
    setKakaoLoading(true);
    setError(null);

    const next = safeNextPath(searchParams.get("next"), "/");
    const result = await signInWithKakao(next);
    if (!result.ok) {
      setError(result.error);
      setKakaoLoading(false);
    }
  };

  const handleEmailSignedIn = () => {
    startPostLoginStatus();
    goNext();
  };

  return (
    <div className="relative flex min-h-dvh flex-col overflow-y-auto overscroll-contain bg-mu-bg">
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden
      >
        <div className="absolute inset-0 bg-gradient-to-b from-mu-bg via-mu-bg to-mu-sunken" />
        <div className="absolute -left-16 top-8 h-48 w-48 rounded-full bg-mu-accent-soft blur-3xl" />
        <div className="absolute -right-10 top-28 h-40 w-40 rounded-full bg-mu-accent-soft/60 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-mobile flex-1 flex-col px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
        <header className="flex w-full shrink-0 flex-col items-center pt-1 text-center animate-fade-up">
          <p
            className="flex items-end justify-center gap-2"
            aria-label="Nice to Met U"
          >
            <span className="pb-1 text-mu-body font-semibold tracking-wide text-mu-fg-3">
              Nice to
            </span>
            <Image
              src="/brand/metu-lockup.png"
              alt=""
              width={200}
              height={80}
              priority
              className="h-11 w-auto max-w-[10rem] object-contain"
            />
          </p>
        </header>

        <div className="flex min-h-0 flex-1 items-center justify-center py-1">
          <LoginWorldHero />
        </div>

        <div
          className="mt-auto flex w-full shrink-0 flex-col pb-1 animate-fade-up"
          style={{ animationDelay: "120ms" }}
        >
          {deleted && !error ? (
            <AuthMessage kind="info" className="mb-2.5">
              회원 탈퇴가 완료되었어요. 이용해 주셔서 감사합니다.
            </AuthMessage>
          ) : null}
          {error ? (
            <AuthMessage kind="error" className="mb-2.5">
              {error.message}
            </AuthMessage>
          ) : null}
          {postLoginStatus ? (
            <p
              role="status"
              className="mb-2.5 text-center text-mu-caption text-mu-fg-2"
            >
              {postLoginStatus}
            </p>
          ) : null}

          <div className="flex flex-col gap-2">
            <section aria-label="이메일 로그인" className="flex flex-col">
              <EmailAuthForm variant="full" onSignedIn={handleEmailSignedIn} />
            </section>

            <div className="flex items-center gap-2.5" aria-hidden>
              <span className="h-px flex-1 bg-mu-line" />
              <span className="text-xs font-medium text-mu-fg-3">
                또는 간편로그인
              </span>
              <span className="h-px flex-1 bg-mu-line" />
            </div>

            <section aria-label="간편로그인" className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => void handleKakaoLogin()}
                disabled={kakaoLoading}
                aria-busy={kakaoLoading}
                className="relative flex min-h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-mu-lg bg-kakao text-sm font-bold text-kakao-ink shadow-kakao-sm transition-transform active:scale-99 disabled:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mu-accent/40"
              >
                {kakaoLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                ) : (
                  <KakaoIcon />
                )}
                {kakaoLoading ? "카카오로 이동 중…" : "카카오 간편로그인"}
              </button>
              {kakaoSlowHint ? (
                <p className="text-center text-mu-caption text-mu-fg-3">
                  오래 걸리면 다시 눌러 주세요
                </p>
              ) : null}
            </section>
          </div>

          <p className="mt-4 text-center text-xs leading-4 text-mu-fg-2">
            계속하면{" "}
            <Link href="/legal/terms" className="underline underline-offset-2">
              이용약관
            </Link>
            과{" "}
            <Link
              href="/legal/privacy"
              className="underline underline-offset-2"
            >
              개인정보처리방침
            </Link>
            에 동의하게 돼요.
          </p>
        </div>
      </div>
    </div>
  );
}

function KakaoIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      aria-hidden
      className="text-kakao-ink"
    >
      <path
        fill="currentColor"
        d="M10 3.2c-4.1 0-7.4 2.6-7.4 5.8 0 2.1 1.4 3.9 3.5 5l-.9 3.3c-.1.3.3.5.5.4l4-2.6c.2 0 .3 0 .5 0 4.1 0 7.4-2.6 7.4-5.8S14.1 3.2 10 3.2z"
      />
    </svg>
  );
}
