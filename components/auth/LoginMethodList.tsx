"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LogIn, Mail } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { LOGIN_METHODS } from "@/lib/auth/login-methods";

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
  const { loginWithKakao, loginWithEmail, signUpWithEmail } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailMode, setEmailMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleKakao = async () => {
    if (loadingId) return;
    setLoadingId("kakao");
    setError(null);
    setNotice(null);
    const message = await loginWithKakao();
    if (message) {
      setError(message);
      setLoadingId(null);
    }
  };

  const handleEmailSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (loadingId) return;
    setLoadingId("email");
    setError(null);
    setNotice(null);

    if (emailMode === "login") {
      const message = await loginWithEmail(email, password);
      if (message) {
        setError(message);
        setLoadingId(null);
        return;
      }
      router.replace("/");
      return;
    }

    const result = await signUpWithEmail(email, password);
    if (result.status === "error") {
      setError(result.message);
      setLoadingId(null);
      return;
    }
    if (result.status === "confirm_email") {
      setNotice(result.message);
      setEmailMode("login");
      setLoadingId(null);
      return;
    }
    router.replace("/");
  };

  const methodList = (
    <>
      {notice ? (
        <p className="rounded-lg border border-brand/20 bg-brand/5 px-3 py-2 text-center text-xs font-medium text-brand-strong">
          {notice}
        </p>
      ) : null}
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
                onClick={() => void handleKakao()}
                disabled={Boolean(loadingId)}
                className={[
                  "relative flex w-full flex-col items-center justify-center gap-0.5 overflow-hidden rounded-xl px-4 py-3 transition-transform active:scale-99 disabled:opacity-80",
                  isKakao
                    ? "bg-kakao text-kakao-ink shadow-kakao-sm"
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
            disabled={Boolean(loadingId)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-line-soft bg-surface-white px-4 py-3 text-sm font-bold text-ink-heading transition-transform active:scale-99 disabled:opacity-80"
          >
            <Mail className="h-4 w-4 text-brand" strokeWidth={2.4} />
            이메일로 로그인
          </button>
        </li>
      </ul>

      {emailOpen ? (
        <form
          onSubmit={(e) => void handleEmailSubmit(e)}
          className="mt-1 flex flex-col gap-2 rounded-xl border border-line-soft bg-surface-base/80 p-3"
        >
          <div className="flex gap-1 rounded-lg bg-surface-soft p-0.5">
            <button
              type="button"
              onClick={() => setEmailMode("login")}
              className={[
                "flex-1 rounded-md py-1.5 text-2xs font-bold",
                emailMode === "login"
                  ? "bg-surface-white text-ink-heading shadow-sm"
                  : "text-ink-caption",
              ].join(" ")}
            >
              로그인
            </button>
            <button
              type="button"
              onClick={() => setEmailMode("signup")}
              className={[
                "flex-1 rounded-md py-1.5 text-2xs font-bold",
                emailMode === "signup"
                  ? "bg-surface-white text-ink-heading shadow-sm"
                  : "text-ink-caption",
              ].join(" ")}
            >
              회원가입
            </button>
          </div>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={Boolean(loadingId)}
            placeholder="이메일"
            className="h-10 rounded-lg border border-line-soft bg-surface-white px-3 text-sm outline-none focus:border-brand/40"
          />
          <input
            type="password"
            required
            minLength={6}
            autoComplete={emailMode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={Boolean(loadingId)}
            placeholder="비밀번호 (6자 이상)"
            className="h-10 rounded-lg border border-line-soft bg-surface-white px-3 text-sm outline-none focus:border-brand/40"
          />
          <button
            type="submit"
            disabled={Boolean(loadingId) || !email.trim() || password.length < 6}
            className="h-10 rounded-lg bg-brand text-sm font-bold text-surface-white disabled:opacity-50"
          >
            {loadingId === "email"
              ? "처리 중…"
              : emailMode === "signup"
                ? "가입하기"
                : "로그인"}
          </button>
        </form>
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
