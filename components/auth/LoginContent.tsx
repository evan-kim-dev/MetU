"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";

export function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginWithKakao, loginAsGuest } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    searchParams.get("error")
  );

  const handleKakaoLogin = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);

    const message = await loginWithKakao();
    if (message) {
      setError(message);
      setIsLoading(false);
    }
    // 성공 시 카카오/Supabase로 리다이렉트됨
  };

  const handleGuest = () => {
    loginAsGuest();
    router.replace("/");
  };

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-surface-base">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(37,99,235,0.18), transparent), linear-gradient(180deg, #F8F9FF 0%, #E9EDF7 100%)",
        }}
        aria-hidden
      />

      <div className="relative z-10 flex flex-1 flex-col px-6 pb-10 pt-16">
        <div className="flex flex-1 flex-col justify-center gap-10">
          <header className="flex flex-col items-center gap-4 text-center">
            <p className="text-[28px] font-extrabold tracking-tight text-brand">
              BudgetTrip <span className="text-ink-heading">AI</span>
            </p>
            <div className="flex flex-col gap-2">
              <h1 className="text-[26px] font-bold leading-8 tracking-tight text-ink-heading">
                예산에 맞춘 여행을
                <br />
                쉽고 빠르게
              </h1>
              <p className="text-sm leading-6 text-ink-body">
                카카오로 시작하고, AI가 예산·일정을 추천해 드려요.
              </p>
            </div>
          </header>

          <div className="flex flex-col gap-3">
            {error && (
              <p className="rounded-xl border border-danger-border bg-white px-3 py-2 text-center text-xs font-medium text-danger">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={() => void handleKakaoLogin()}
              disabled={isLoading}
              className="flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[#FEE500] text-base font-bold text-[#191919] transition-transform active:scale-[0.99] disabled:opacity-70"
            >
              <KakaoIcon />
              {isLoading ? "카카오로 이동 중…" : "카카오 간편로그인"}
            </button>

            <button
              type="button"
              onClick={handleGuest}
              className="h-[52px] w-full rounded-2xl border border-line-soft bg-surface-white text-sm font-semibold text-ink-body transition-colors active:bg-surface-soft"
            >
              둘러보기
            </button>
          </div>
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
