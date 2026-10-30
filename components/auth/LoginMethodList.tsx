"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2, LogIn, Mail } from "lucide-react";
import { AuthMessage } from "@/components/auth/AuthMessage";
import { EmailAuthForm } from "@/components/auth/EmailAuthForm";
import { useAuthActions } from "@/components/auth/useAuthActions";
import { LOGIN_METHODS } from "@/lib/auth/login-methods";
import type { UserFacingError } from "@/lib/errors/user-message";

interface LoginMethodListProps {
  /** true면 로그인 박스 탭 시 방법 목록 펼침 */
  collapsible?: boolean;
  className?: string;
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

export function LoginMethodList({
  collapsible = false,
  className = "",
}: LoginMethodListProps) {
  const router = useRouter();
  const { signInWithKakao } = useAuthActions();
  const [isOpen, setIsOpen] = useState(false);
  const [kakaoLoading, setKakaoLoading] = useState(false);
  const [error, setError] = useState<UserFacingError | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);

  useEffect(() => {
    const clear = () => setKakaoLoading(false);
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) clear();
    };
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", clear);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", clear);
    };
  }, []);

  const handleKakao = async () => {
    if (kakaoLoading) return;
    setKakaoLoading(true);
    setError(null);
    const result = await signInWithKakao();
    if (!result.ok) {
      setError(result.error);
      setKakaoLoading(false);
    }
  };

  const methodList = (
    <>
      {error ? (
        <AuthMessage kind="error">{error.message}</AuthMessage>
      ) : null}

      <ul className="flex flex-col gap-2">
        {LOGIN_METHODS.map((method) => {
          const isLoading = kakaoLoading;
          const isKakao = method.variant === "kakao";

          return (
            <li key={method.id}>
              <button
                type="button"
                onClick={() => void handleKakao()}
                disabled={isLoading}
                aria-busy={isLoading && isKakao}
                className={[
                  "relative flex min-h-touch w-full flex-col items-center justify-center gap-0.5 overflow-hidden rounded-xl px-4 py-3 transition-transform active:scale-99 disabled:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
                  isKakao
                    ? "bg-kakao text-kakao-ink shadow-kakao-sm"
                    : "border border-line-soft bg-surface-white text-ink-body",
                ].join(" ")}
              >
                <span className="flex items-center justify-center gap-2 text-sm font-bold">
                  {isKakao && isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : isKakao ? (
                    <KakaoIcon />
                  ) : null}
                  {isLoading && isKakao ? method.loadingLabel : method.label}
                </span>
                {method.description ? (
                  <span
                    className={[
                      "text-xs font-medium",
                      isKakao ? "text-kakao-ink/70" : "text-ink-caption",
                    ].join(" ")}
                  >
                    {method.description}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}

        <li>
          <button
            type="button"
            onClick={() => setEmailOpen((prev) => !prev)}
            disabled={kakaoLoading}
            aria-expanded={emailOpen}
            className="flex min-h-touch w-full items-center justify-center gap-2 rounded-xl border border-line-soft bg-surface-white px-4 py-3 text-sm font-bold text-ink-heading transition-transform active:scale-99 disabled:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            <Mail className="h-4 w-4 text-brand" strokeWidth={2.4} />
            이메일로 계속하기
          </button>
        </li>
      </ul>

      {emailOpen ? (
        <EmailAuthForm
          variant="compact"
          className="mt-1"
          onSignedIn={() => router.replace("/")}
        />
      ) : null}
    </>
  );

  if (!collapsible) {
    return (
      <div className={`flex w-full flex-col gap-3 ${className}`}>
        <p className="text-center text-sm font-bold text-ink-heading">로그인</p>
        {methodList}
      </div>
    );
  }

  return (
    <div
      className={`w-full overflow-hidden rounded-xl border border-line-soft bg-surface-soft/80 ${className}`}
    >
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors active:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
            <LogIn className="h-4 w-4" strokeWidth={2.4} />
          </span>
          <span className="text-sm font-bold text-ink-heading">로그인</span>
        </span>
        <ChevronDown
          className={[
            "h-5 w-5 shrink-0 text-ink-caption transition-transform duration-200",
            isOpen ? "rotate-180" : "",
          ].join(" ")}
          strokeWidth={2.2}
          aria-hidden
        />
      </button>

      {isOpen ? (
        <div className="flex flex-col gap-3 border-t border-line-soft px-4 pb-4 pt-3">
          {methodList}
        </div>
      ) : null}
    </div>
  );
}
