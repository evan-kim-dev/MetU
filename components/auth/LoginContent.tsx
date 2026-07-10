"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";
import { MetULogo } from "@/components/ui/MetULogo";

const TAGLINES = [
  "AI가 예산에 맞춘 여행 일정을 쉽고 빠르게 추천해 드려요.",
  "동행 모집부터 체크리스트까지 한번에 준비해요.",
  "지금 떠날 여행을 바로 계획해 보세요.",
] as const;

const FEATURES = ["예산 맞춤", "AI 일정", "동행·게시판"] as const;

export function LoginContent() {
  const searchParams = useSearchParams();
  const { loginWithKakao, loginAsGuest } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(searchParams.get("error"));
  const [taglineIndex, setTaglineIndex] = useState(0);
  const [taglineVisible, setTaglineVisible] = useState(true);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTaglineVisible(false);
      window.setTimeout(() => {
        setTaglineIndex((prev) => (prev + 1) % TAGLINES.length);
        setTaglineVisible(true);
      }, 220);
    }, 3600);

    return () => window.clearInterval(interval);
  }, []);

  const handleKakaoLogin = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);

    const message = await loginWithKakao();
    if (message) {
      setError(message);
      setIsLoading(false);
    }
  };

  const handleGuest = () => {
    loginAsGuest();
    const next = searchParams.get("next");
    window.location.assign(next?.startsWith("/") ? next : "/");
  };

  return (
    <div className="relative flex h-dvh min-h-dvh flex-col overflow-hidden bg-surface-base">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, #F8F9FF 0%, #E9EDF7 55%, #E3E8F5 100%)",
          }}
        />
        <div className="absolute -left-16 top-8 h-56 w-56 animate-glow-pulse rounded-full bg-brand/20 blur-3xl" />
        <div className="absolute -right-10 top-28 h-44 w-44 animate-float-soft rounded-full bg-[#60A5FA]/25 blur-3xl [animation-delay:1.2s]" />
        <div className="absolute bottom-40 left-1/2 h-36 w-72 -translate-x-1/2 animate-glow-pulse rounded-full bg-brand/10 blur-3xl [animation-delay:0.6s]" />
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        <div className="flex flex-1 flex-col items-center justify-center -translate-y-8">
          <header className="flex w-full flex-col items-center gap-6 text-center animate-fade-up">
            <MetULogo variant="hero" showPlannerBadge />

            <div className="flex min-h-[52px] max-w-[320px] flex-col items-center justify-center gap-3">
              <h1
                className={[
                  "text-[18px] font-bold leading-7 tracking-tight text-ink-heading transition-all duration-300",
                  taglineVisible
                    ? "translate-y-0 opacity-100"
                    : "translate-y-1 opacity-0",
                ].join(" ")}
              >
                {TAGLINES[taglineIndex]}
              </h1>
              <div className="flex flex-wrap justify-center gap-2">
                {FEATURES.map((feature, index) => (
                  <span
                    key={feature}
                    className="ai-glass-chip animate-fade-up"
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
            {error && (
              <p className="rounded-xl border border-danger-border bg-white/90 px-3 py-2 text-center text-xs font-medium text-danger backdrop-blur-sm animate-fade-up">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={() => void handleKakaoLogin()}
              disabled={isLoading}
              className="relative flex h-[52px] w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-[#FEE500] text-base font-bold text-[#191919] shadow-[0_8px_24px_rgba(254,229,0,0.35)] transition-transform active:scale-[0.99] disabled:opacity-80"
            >
              {isLoading ? (
                <span className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/35 to-transparent" />
              ) : null}
              <KakaoIcon />
              {isLoading ? "카카오로 이동 중…" : "카카오 간편로그인"}
            </button>

            <button
              type="button"
              onClick={handleGuest}
              disabled={isLoading}
              className="h-[52px] w-full rounded-2xl border border-line-soft bg-surface-white/90 text-sm font-semibold text-ink-body backdrop-blur-sm transition-all active:scale-[0.99] active:bg-surface-soft disabled:opacity-60"
            >
              둘러보기
            </button>
          </div>

          <p className="text-center text-[11px] leading-5 text-ink-caption">
            계속하면{" "}
            <Link href="/legal/terms" className="underline underline-offset-2">
              이용약관
            </Link>
            과{" "}
            <Link href="/legal/privacy" className="underline underline-offset-2">
              개인정보처리방침
            </Link>
            에 동의하게 됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}

function KakaoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
      <path
        fill="#191919"
        d="M10 3.2c-4.1 0-7.4 2.6-7.4 5.8 0 2.1 1.4 3.9 3.5 5l-.9 3.3c-.1.3.3.5.5.4l4-2.6c.2 0 .3 0 .5 0 4.1 0 7.4-2.6 7.4-5.8S14.1 3.2 10 3.2z"
      />
    </svg>
  );
}
