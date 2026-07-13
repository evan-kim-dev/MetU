"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { MetULogo } from "@/components/ui/MetULogo";

const TAGLINES = [
  "Nice to Met U!",
  "AI가 예산에 맞춘 여행 일정을 쉽고 빠르게 추천해 드려요.",
  "동행 모집부터 체크리스트까지 한번에 준비해요.",
  "지금 떠날 여행을 바로 계획해 보세요.",
] as const;

const FEATURES = ["예산 맞춤", "AI 일정", "동행·게시판"] as const;

type EmailMode = "login" | "signup";

export function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginWithKakao, loginWithEmail, signUpWithEmail, loginAsGuest } =
    useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(searchParams.get("error"));
  const [notice, setNotice] = useState<string | null>(null);
  const deleted = searchParams.get("deleted") === "1";
  const [taglineIndex, setTaglineIndex] = useState(0);
  const [taglineVisible, setTaglineVisible] = useState(true);

  const [emailOpen, setEmailOpen] = useState(false);
  const [emailMode, setEmailMode] = useState<EmailMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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

  const goNext = () => {
    const next = searchParams.get("next");
    router.replace(next?.startsWith("/") ? next : "/");
  };

  const handleKakaoLogin = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    setNotice(null);

    const message = await loginWithKakao();
    if (message) {
      setError(message);
      setIsLoading(false);
    }
  };

  const handleGuest = () => {
    loginAsGuest();
    goNext();
  };

  const handleEmailSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    setNotice(null);

    if (emailMode === "login") {
      const message = await loginWithEmail(email, password);
      if (message) {
        setError(message);
        setIsLoading(false);
        return;
      }
      goNext();
      return;
    }

    const result = await signUpWithEmail(email, password);
    if (result.status === "error") {
      setError(result.message);
      setIsLoading(false);
      return;
    }
    if (result.status === "confirm_email") {
      setNotice(result.message);
      setEmailMode("login");
      setIsLoading(false);
      return;
    }
    goNext();
  };

  return (
    <div className="relative flex h-dvh min-h-dvh flex-col overflow-hidden bg-surface-base">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute inset-0 bg-gradient-to-b from-surface-base via-canvas to-canvas-deep" />
        <div className="absolute -left-16 top-8 h-48 w-48 rounded-full bg-brand/10 blur-3xl" />
        <div className="absolute -right-10 top-28 h-40 w-40 rounded-full bg-brand-mid/12 blur-3xl" />
        <div className="absolute bottom-48 left-1/2 h-28 w-56 -translate-x-1/2 rounded-full bg-brand/[0.06] blur-2xl" />
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        <div className="flex flex-1 flex-col items-center justify-center -translate-y-8">
          <header className="flex w-full flex-col items-center gap-6 text-center animate-fade-up">
            <MetULogo variant="hero" showPlannerBadge />

            <div className="flex min-h-touch max-w-prose flex-col items-center justify-center gap-3">
              <h1
                className={[
                  "text-lg font-bold leading-7 tracking-tight text-ink-heading transition-all duration-300",
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
            {deleted && !error && !notice ? (
              <p className="rounded-xl border border-line-soft bg-white/90 px-3 py-2 text-center text-xs font-medium text-ink-body backdrop-blur-sm animate-fade-up">
                회원 탈퇴가 완료되었어요. 이용해 주셔서 감사합니다.
              </p>
            ) : null}
            {notice ? (
              <p className="rounded-xl border border-brand/20 bg-brand/5 px-3 py-2 text-center text-xs font-medium text-brand-strong backdrop-blur-sm animate-fade-up">
                {notice}
              </p>
            ) : null}
            {error ? (
              <p className="rounded-xl border border-danger-border bg-white/90 px-3 py-2 text-center text-xs font-medium text-danger backdrop-blur-sm animate-fade-up">
                {error}
              </p>
            ) : null}

            <button
              type="button"
              onClick={() => void handleKakaoLogin()}
              disabled={isLoading}
              className="relative flex h-touch w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-kakao text-base font-bold text-kakao-ink shadow-kakao-sm transition-transform active:scale-99 disabled:opacity-80"
            >
              {isLoading ? (
                <span className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/35 to-transparent" />
              ) : null}
              <KakaoIcon />
              {isLoading ? "카카오로 이동 중…" : "카카오 간편로그인"}
            </button>

            <button
              type="button"
              onClick={() => {
                setEmailOpen((prev) => !prev);
                setError(null);
                setNotice(null);
              }}
              disabled={isLoading}
              className="flex h-touch w-full items-center justify-center gap-2 rounded-2xl border border-line-soft bg-surface-white text-sm font-bold text-ink-heading shadow-sm transition-all active:scale-99 active:bg-surface-soft disabled:opacity-60"
            >
              <Mail className="h-4 w-4 text-brand" strokeWidth={2.4} />
              이메일로 {emailMode === "signup" ? "가입" : "로그인"}
            </button>

            {emailOpen ? (
              <form
                onSubmit={(e) => void handleEmailSubmit(e)}
                className="flex flex-col gap-2.5 rounded-2xl border border-line-soft bg-surface-white/95 p-3.5 shadow-sm backdrop-blur-sm animate-fade-up"
              >
                <div className="flex gap-2 rounded-xl bg-surface-soft p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEmailMode("login");
                      setError(null);
                      setNotice(null);
                    }}
                    className={[
                      "flex-1 rounded-lg py-2 text-xs font-bold transition-colors",
                      emailMode === "login"
                        ? "bg-surface-white text-ink-heading shadow-sm"
                        : "text-ink-caption",
                    ].join(" ")}
                  >
                    로그인
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEmailMode("signup");
                      setError(null);
                      setNotice(null);
                    }}
                    className={[
                      "flex-1 rounded-lg py-2 text-xs font-bold transition-colors",
                      emailMode === "signup"
                        ? "bg-surface-white text-ink-heading shadow-sm"
                        : "text-ink-caption",
                    ].join(" ")}
                  >
                    회원가입
                  </button>
                </div>

                <label className="flex flex-col gap-1.5">
                  <span className="text-2xs font-bold text-ink-caption">이메일</span>
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    placeholder="you@example.com"
                    className="h-11 rounded-xl border border-line-soft bg-surface-base px-3.5 text-sm text-ink-heading outline-none placeholder:text-ink-caption focus:border-brand/40 disabled:opacity-60"
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-2xs font-bold text-ink-caption">비밀번호</span>
                  <input
                    type="password"
                    autoComplete={
                      emailMode === "signup" ? "new-password" : "current-password"
                    }
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    placeholder="6자 이상"
                    className="h-11 rounded-xl border border-line-soft bg-surface-base px-3.5 text-sm text-ink-heading outline-none placeholder:text-ink-caption focus:border-brand/40 disabled:opacity-60"
                  />
                </label>

                <button
                  type="submit"
                  disabled={isLoading || !email.trim() || password.length < 6}
                  className="relative mt-0.5 flex h-11 w-full items-center justify-center overflow-hidden rounded-xl bg-brand text-sm font-bold text-surface-white transition-transform active:scale-99 disabled:opacity-50"
                >
                  {isLoading ? (
                    <span className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/25 to-transparent" />
                  ) : null}
                  {isLoading
                    ? emailMode === "signup"
                      ? "가입 중…"
                      : "로그인 중…"
                    : emailMode === "signup"
                      ? "이메일로 가입하기"
                      : "이메일로 로그인"}
                </button>
              </form>
            ) : null}

            <button
              type="button"
              onClick={handleGuest}
              disabled={isLoading}
              className="h-touch w-full rounded-2xl border-0 bg-surface-white shadow-sm text-sm font-semibold text-ink-body backdrop-blur-sm transition-all active:scale-99 active:bg-surface-soft disabled:opacity-60"
            >
              둘러보기
            </button>
          </div>

          <p className="text-center text-xs leading-5 text-ink-caption">
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
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden className="text-kakao-ink">
      <path
        fill="currentColor"
        d="M10 3.2c-4.1 0-7.4 2.6-7.4 5.8 0 2.1 1.4 3.9 3.5 5l-.9 3.3c-.1.3.3.5.5.4l4-2.6c.2 0 .3 0 .5 0 4.1 0 7.4-2.6 7.4-5.8S14.1 3.2 10 3.2z"
      />
    </svg>
  );
}
