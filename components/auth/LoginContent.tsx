"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, Mail } from "lucide-react";
import { AuthMessage } from "@/components/auth/AuthMessage";
import { EmailAuthForm } from "@/components/auth/EmailAuthForm";
import { useAuthActions } from "@/components/auth/useAuthActions";
import { MetULogo } from "@/components/ui/MetULogo";
import {
  callbackErrorCode,
  callbackErrorToUserFacing,
} from "@/lib/auth/callback-error";
import { safeNextPath } from "@/lib/security/safe-next";
import type { UserFacingError } from "@/lib/errors/user-message";

const FEATURES = ["예산 맞춤", "AI 일정", "자동 가계부", "정산"] as const;

export function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signInWithKakao, continueAsGuest } = useAuthActions();

  const [kakaoLoading, setKakaoLoading] = useState(false);
  const [kakaoSlowHint, setKakaoSlowHint] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [error, setError] = useState<UserFacingError | null>(null);
  const [guestError, setGuestError] = useState(false);
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
    if (kakaoLoading || guestLoading) return;
    setKakaoLoading(true);
    setError(null);
    setGuestError(false);

    const result = await signInWithKakao();
    if (!result.ok) {
      setError(result.error);
      setKakaoLoading(false);
    }
  };

  const handleGuest = async () => {
    if (guestLoading || kakaoLoading) return;
    setGuestLoading(true);
    setGuestError(false);
    setError(null);

    const result = await continueAsGuest();
    if (!result.ok) {
      setGuestError(true);
      setGuestLoading(false);
      return;
    }
    goNext();
  };

  const handleEmailSignedIn = () => {
    startPostLoginStatus();
    goNext();
  };

  const anyLoading = kakaoLoading || guestLoading;

  return (
    <div className="relative flex min-h-dvh flex-col overflow-y-auto overscroll-contain bg-surface-base">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute inset-0 bg-gradient-to-b from-surface-base via-canvas to-canvas-deep" />
        <div className="absolute -left-16 top-8 h-48 w-48 rounded-full bg-brand/10 blur-3xl" />
        <div className="absolute -right-10 top-28 h-40 w-40 rounded-full bg-brand-mid/12 blur-3xl" />
        <div className="absolute bottom-48 left-1/2 h-28 w-56 -translate-x-1/2 rounded-full bg-brand/[0.06] blur-2xl" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-mobile flex-1 flex-col px-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex flex-1 flex-col items-center justify-center py-6">
          <header className="flex w-full flex-col items-center gap-5 text-center animate-fade-up">
            <MetULogo variant="hero" showPlannerBadge />

            <div className="flex max-w-prose flex-col items-center gap-3">
              <p className="text-xs font-semibold tracking-wide text-brand-strong">
                Nice to Met U!
              </p>
              <h1 className="text-lg font-bold leading-7 tracking-tight text-ink-heading">
                여행 경비, 같이 쓰고 알아서 정산해요
              </h1>
              <p className="text-sm leading-6 text-ink-body">
                카드 알림이 오면 자동으로 가계부에 적고, 동행과 정산까지 한 번에
                끝내요.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {FEATURES.map((feature, index) => (
                  <span
                    key={feature}
                    className="ai-glass-chip animate-fade-up px-3 py-1.5 text-xs"
                    style={{ animationDelay: `${120 + index * 80}ms` }}
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          </header>
        </div>

        <div
          className="flex w-full shrink-0 flex-col gap-4 animate-fade-up"
          style={{ animationDelay: "180ms" }}
        >
          <div className="flex flex-col gap-3">
            {deleted && !error && !guestError ? (
              <AuthMessage kind="info">
                회원 탈퇴가 완료되었어요. 이용해 주셔서 감사합니다.
              </AuthMessage>
            ) : null}
            {error ? (
              <AuthMessage kind="error">{error.message}</AuthMessage>
            ) : null}
            {guestError ? (
              <AuthMessage
                kind="error"
                action={{
                  label: "다시 시도",
                  onClick: () => void handleGuest(),
                }}
              >
                둘러보기를 시작하지 못했어요. 잠시 뒤 다시 시도해 주세요.
              </AuthMessage>
            ) : null}
            {postLoginStatus ? (
              <p role="status" className="text-center text-xs text-ink-body">
                {postLoginStatus}
              </p>
            ) : null}

            <button
              type="button"
              onClick={() => void handleKakaoLogin()}
              disabled={anyLoading}
              aria-busy={kakaoLoading}
              className="relative flex min-h-touch w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-kakao text-base font-bold text-kakao-ink shadow-kakao-sm transition-transform active:scale-99 disabled:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              {kakaoLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              ) : (
                <KakaoIcon />
              )}
              {kakaoLoading ? "카카오로 이동 중…" : "카카오 간편로그인"}
            </button>
            {kakaoSlowHint ? (
              <p className="text-center text-xs text-ink-caption">
                오래 걸리면 다시 눌러 주세요
              </p>
            ) : null}

            <button
              type="button"
              onClick={() => {
                setEmailOpen((prev) => !prev);
                setError(null);
                setGuestError(false);
              }}
              disabled={anyLoading}
              aria-expanded={emailOpen}
              className="flex min-h-touch w-full items-center justify-center gap-2 rounded-2xl border border-line-soft bg-surface-white text-sm font-bold text-ink-heading shadow-sm transition-all active:scale-99 active:bg-surface-soft disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              <Mail className="h-4 w-4 text-brand" strokeWidth={2.4} />
              이메일로 계속하기
            </button>

            {emailOpen ? (
              <EmailAuthForm variant="full" onSignedIn={handleEmailSignedIn} />
            ) : null}

            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => void handleGuest()}
                disabled={anyLoading}
                aria-busy={guestLoading}
                className="min-h-touch w-full rounded-2xl border-0 bg-surface-white text-sm font-semibold text-ink-body shadow-sm backdrop-blur-sm transition-all active:scale-99 active:bg-surface-soft disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
              >
                {guestLoading ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    들어가는 중…
                  </span>
                ) : (
                  "로그인 없이 둘러보기"
                )}
              </button>
              <p className="text-center text-xs leading-5 text-ink-body">
                둘러보기에서는 저장과 자동 기록 연결 같은 일부 기능이 제한돼요.
              </p>
            </div>
          </div>

          <p className="text-center text-xs leading-5 text-ink-body">
            계속하면{" "}
            <Link href="/legal/terms" className="underline underline-offset-2">
              이용약관
            </Link>
            과{" "}
            <Link href="/legal/privacy" className="underline underline-offset-2">
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
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden className="text-kakao-ink">
      <path
        fill="currentColor"
        d="M10 3.2c-4.1 0-7.4 2.6-7.4 5.8 0 2.1 1.4 3.9 3.5 5l-.9 3.3c-.1.3.3.5.5.4l4-2.6c.2 0 .3 0 .5 0 4.1 0 7.4-2.6 7.4-5.8S14.1 3.2 10 3.2z"
      />
    </svg>
  );
}
