"use client";

import { useState } from "react";
import { ChevronDown, LogIn } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { LOGIN_METHODS } from "@/lib/auth/login-methods";

interface LoginMethodListProps {
  /** true면 로그인 박스 탭 시 방법 목록 펼침 */
  collapsible?: boolean;
  className?: string;
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

export function LoginMethodList({
  collapsible = false,
  className = "",
}: LoginMethodListProps) {
  const { loginWithKakao } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (methodId: (typeof LOGIN_METHODS)[number]["id"]) => {
    if (loadingId) return;
    setLoadingId(methodId);
    setError(null);

    const message =
      methodId === "kakao"
        ? await loginWithKakao()
        : "지원하지 않는 로그인 방식이에요.";
    if (message) {
      setError(message);
      setLoadingId(null);
    }
  };

  const methodList = (
    <>
      {error ? (
        <p className="rounded-lg border border-danger-border bg-danger/5 px-3 py-2 text-center text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {LOGIN_METHODS.map((method) => {
          const isLoading = loadingId === method.id;
          const isKakao = method.variant === "kakao";

          return (
            <li key={method.id}>
              <button
                type="button"
                onClick={() => void handleLogin(method.id)}
                disabled={Boolean(loadingId)}
                className={[
                  "relative flex w-full flex-col items-center justify-center gap-0.5 overflow-hidden rounded-xl px-4 py-3 transition-transform active:scale-[0.99] disabled:opacity-80",
                  isKakao
                    ? "bg-[#FEE500] text-[#191919] shadow-[0_4px_16px_rgba(254,229,0,0.3)]"
                    : "border border-line-soft bg-surface-white text-ink-body",
                ].join(" ")}
              >
                {isLoading ? (
                  <span className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/35 to-transparent" />
                ) : null}
                <span className="flex items-center justify-center gap-2 text-sm font-bold">
                  {isKakao ? <KakaoIcon /> : null}
                  {isLoading ? method.loadingLabel : method.label}
                </span>
                {method.description ? (
                  <span
                    className={[
                      "text-[11px] font-medium",
                      isKakao ? "text-[#191919]/70" : "text-ink-caption",
                    ].join(" ")}
                  >
                    {method.description}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
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
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors active:bg-surface-soft"
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
