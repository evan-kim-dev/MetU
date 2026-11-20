"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { Check, Loader2 } from "lucide-react";
import { AuthMessage } from "@/components/auth/AuthMessage";
import { useAuthActions } from "@/components/auth/useAuthActions";
import {
  evaluatePassword,
  type PasswordStrengthLevel,
} from "@/lib/auth/password-strength";
import type { UserFacingError } from "@/lib/errors/user-message";

const STRENGTH_BAR: Record<
  Exclude<PasswordStrengthLevel, "empty">,
  string
> = {
  danger: "bg-mu-err",
  weak: "bg-mu-warn",
  fair: "bg-mu-accent",
  strong: "bg-mu-ok",
};

const STRENGTH_TEXT: Record<
  Exclude<PasswordStrengthLevel, "empty">,
  string
> = {
  danger: "text-mu-err",
  weak: "text-mu-warn",
  fair: "text-mu-accent",
  strong: "text-mu-ok",
};

type EmailMode = "login" | "signup";

export interface EmailAuthFormProps {
  variant?: "full" | "compact";
  onSignedIn?: () => void;
  className?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function useReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduce(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduce;
}

export function EmailAuthForm({
  variant = "full",
  onSignedIn,
  className = "",
}: EmailAuthFormProps) {
  const {
    signInWithEmail,
    signUpWithEmail,
    resendConfirmation,
  } = useAuthActions();
  const reduceMotion = useReducedMotion();
  const emailId = useId();
  const passwordId = useId();

  const [mode, setMode] = useState<EmailMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<UserFacingError | null>(null);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  /** 이메일 입력을 마친 뒤(blur/Enter)에만 비밀번호 단계를 연다. */
  const [emailStepDone, setEmailStepDone] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const wasEmailStepDone = useRef(false);

  const strength = evaluatePassword(password);
  const emailReady = EMAIL_RE.test(email.trim());
  const showPasswordStep = emailStepDone && emailReady;
  const emailInvalid =
    emailTouched && email.trim().length > 0 && !emailReady;
  const passwordInvalid =
    passwordTouched &&
    password.length > 0 &&
    (mode === "signup"
      ? !strength.meetsSignupPolicy
      : !strength.meetsLoginPolicy);
  const canSubmit =
    showPasswordStep &&
    !busy &&
    (mode === "signup"
      ? strength.meetsSignupPolicy
      : strength.meetsLoginPolicy);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = window.setInterval(() => {
      setResendCooldown((n) => (n <= 1 ? 0 : n - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [resendCooldown]);

  useEffect(() => {
    if (showPasswordStep && !wasEmailStepDone.current) {
      wasEmailStepDone.current = true;
      window.requestAnimationFrame(() => {
        passwordRef.current?.focus();
      });
      return;
    }
    if (!showPasswordStep) {
      wasEmailStepDone.current = false;
    }
  }, [showPasswordStep]);

  const commitEmailStep = useCallback(() => {
    setEmailTouched(true);
    if (!EMAIL_RE.test(email.trim())) {
      setEmailStepDone(false);
      return false;
    }
    setEmailStepDone(true);
    return true;
  }, [email]);

  const focusFirstError = useCallback(() => {
    if (emailInvalid || !email.trim()) {
      emailRef.current?.focus();
      return;
    }
    if (
      passwordInvalid ||
      (mode === "signup"
        ? !strength.meetsSignupPolicy
        : !strength.meetsLoginPolicy)
    ) {
      passwordRef.current?.focus();
    }
  }, [
    emailInvalid,
    passwordInvalid,
    email,
    mode,
    strength.meetsSignupPolicy,
    strength.meetsLoginPolicy,
  ]);

  const scrollFieldIntoView = (el: HTMLElement | null) => {
    if (!el || typeof el.scrollIntoView !== "function") return;
    el.scrollIntoView({
      block: "center",
      behavior: reduceMotion ? "auto" : "smooth",
    });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);

    if (mode === "login") {
      const result = await signInWithEmail(email, password);
      if (!result.ok) {
        setError(result.error);
        setBusy(false);
        focusFirstError();
        return;
      }
      onSignedIn?.();
      return;
    }

    const result = await signUpWithEmail(email, password);
    if (!result.ok) {
      setError(result.error);
      setBusy(false);
      if (result.error.action === "switch-to-login") {
        setMode("login");
      }
      focusFirstError();
      return;
    }
    if (result.status === "confirm-email") {
      setConfirmEmail(result.email);
      setResendCooldown(60);
      setBusy(false);
      return;
    }
    onSignedIn?.();
  };

  const handleResend = async () => {
    if (!confirmEmail || resendCooldown > 0 || busy) return;
    setBusy(true);
    setError(null);
    const result = await resendConfirmation(confirmEmail);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setResendCooldown(60);
  };

  const switchTab = (next: EmailMode) => {
    setMode(next);
    setError(null);
    setConfirmEmail(null);
  };

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, next: EmailMode) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      switchTab(next === "login" ? "signup" : "login");
    }
  };

  const compact = variant === "compact";
  const formPad = compact ? "p-3 gap-2" : "p-3.5 gap-2.5";

  if (confirmEmail) {
    return (
      <div
        role="status"
        className={[
          "flex flex-col gap-3 rounded-2xl border border-line-soft bg-surface-white/95 shadow-sm backdrop-blur-sm",
          formPad,
          className,
        ].join(" ")}
      >
        <div className="text-left">
          <p className="text-sm font-bold text-ink-heading">확인 메일을 보냈어요</p>
          <p className="mt-2 text-sm leading-6 text-ink-body">
            {confirmEmail} 로 보낸 메일의 &apos;이메일 확인&apos;을 누르면 가입이
            끝나요. 메일이 안 보이면 스팸함도 확인해 주세요.
          </p>
        </div>
        {error ? (
          <AuthMessage kind="error">{error.message}</AuthMessage>
        ) : null}
        <button
          type="button"
          disabled={resendCooldown > 0 || busy}
          aria-busy={busy}
          onClick={() => void handleResend()}
          className="relative flex min-h-touch w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-bold text-surface-white disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {resendCooldown > 0
            ? `다시 보내기 (${resendCooldown}초)`
            : "확인 메일 다시 보내기"}
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirmEmail(null);
            setEmail("");
            setPassword("");
            setMode("signup");
          }}
          className="min-h-touch w-full rounded-xl border border-line-soft bg-surface-white text-sm font-semibold text-ink-body"
        >
          다른 이메일로 가입
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className={[
        "flex flex-col rounded-2xl border border-line-soft bg-surface-white/95 shadow-sm backdrop-blur-sm animate-fade-up",
        formPad,
        className,
      ].join(" ")}
      noValidate
    >
      {error ? (
        <AuthMessage kind="error">{error.message}</AuthMessage>
      ) : null}

      {showPasswordStep ? (
        <div
          role="tablist"
          aria-label="로그인 또는 회원가입"
          className="flex gap-2 rounded-xl bg-surface-soft p-1"
        >
          <button
            type="button"
            role="tab"
            id={`${emailId}-tab-login`}
            aria-selected={mode === "login"}
            aria-controls={`${emailId}-panel`}
            onKeyDown={(e) => onTabKeyDown(e, "login")}
            onClick={() => switchTab("login")}
            className={[
              "flex-1 rounded-lg py-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
              mode === "login"
                ? "bg-surface-white text-ink-heading shadow-sm"
                : "text-ink-caption",
            ].join(" ")}
          >
            로그인
          </button>
          <button
            type="button"
            role="tab"
            id={`${emailId}-tab-signup`}
            aria-selected={mode === "signup"}
            aria-controls={`${emailId}-panel`}
            onKeyDown={(e) => onTabKeyDown(e, "signup")}
            onClick={() => switchTab("signup")}
            className={[
              "flex-1 rounded-lg py-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
              mode === "signup"
                ? "bg-surface-white text-ink-heading shadow-sm"
                : "text-ink-caption",
            ].join(" ")}
          >
            회원가입
          </button>
        </div>
      ) : null}

      <div
        id={showPasswordStep ? `${emailId}-panel` : undefined}
        role={showPasswordStep ? "tabpanel" : undefined}
        className="flex flex-col gap-2"
      >
        <label htmlFor={emailId} className="flex flex-col gap-1.5 text-left">
          <span className="text-xs font-bold text-ink-caption">이메일</span>
          <input
            ref={emailRef}
            id={emailId}
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            value={email}
            onChange={(e) => {
              const next = e.target.value;
              setEmail(next);
              if (emailStepDone && !EMAIL_RE.test(next.trim())) {
                setEmailStepDone(false);
              }
            }}
            onBlur={() => {
              commitEmailStep();
              scrollFieldIntoView(emailRef.current);
            }}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              if (commitEmailStep()) {
                window.requestAnimationFrame(() => {
                  passwordRef.current?.focus();
                });
              }
            }}
            disabled={busy}
            placeholder="you@example.com"
            aria-invalid={emailInvalid}
            aria-describedby={emailInvalid ? `${emailId}-err` : undefined}
            className="min-h-touch rounded-xl border border-line-soft bg-surface-base px-3.5 text-base text-ink-heading outline-none placeholder:text-ink-caption focus:border-brand/40 focus-visible:ring-2 focus-visible:ring-brand/30 disabled:opacity-60"
          />
          {emailInvalid ? (
            <span id={`${emailId}-err`} className="text-xs text-danger">
              이메일 형식을 확인해 주세요.
            </span>
          ) : null}
        </label>

        {showPasswordStep ? (
          <>
            <div className="flex flex-col gap-1.5 text-left">
              <label
                htmlFor={passwordId}
                className="text-xs font-bold text-ink-caption"
              >
                비밀번호
              </label>
              <div className="relative">
                <input
                  ref={passwordRef}
                  id={passwordId}
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    mode === "signup" ? "new-password" : "current-password"
                  }
                  required
                  minLength={mode === "signup" ? 8 : 6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => {
                    setPasswordTouched(true);
                    scrollFieldIntoView(passwordRef.current);
                  }}
                  disabled={busy}
                  placeholder={
                    mode === "signup"
                      ? "8자 이상, 영문·숫자·특수문자"
                      : "비밀번호"
                  }
                  aria-invalid={passwordInvalid}
                  aria-describedby={[
                    mode === "signup" && password.length > 0
                      ? `${passwordId}-strength`
                      : null,
                    passwordInvalid ? `${passwordId}-err` : null,
                  ]
                    .filter(Boolean)
                    .join(" ") || undefined}
                  className="min-h-touch w-full rounded-xl border border-line-soft bg-surface-base px-3.5 pr-16 text-base text-ink-heading outline-none placeholder:text-ink-caption focus:border-brand/40 focus-visible:ring-2 focus-visible:ring-brand/30 disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-pressed={showPassword}
                  aria-label={
                    showPassword ? "비밀번호 숨기기" : "비밀번호 표시"
                  }
                  className="absolute right-1 top-1/2 flex min-h-touch min-w-11 -translate-y-1/2 items-center justify-center rounded-lg px-2 text-xs font-bold text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                >
                  {showPassword ? "숨기기" : "표시"}
                </button>
              </div>

              {mode === "signup" &&
              password.length > 0 &&
              strength.level !== "empty"
                ? (() => {
                    const level = strength.level;
                    return (
                      <div
                        id={`${passwordId}-strength`}
                        className="flex flex-col gap-1.5"
                        aria-live="polite"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-ink-caption">
                            보안 강도
                          </span>
                          <span
                            className={[
                              "text-xs font-bold",
                              STRENGTH_TEXT[level],
                            ].join(" ")}
                          >
                            {strength.label}
                          </span>
                        </div>
                        <div
                          className="grid grid-cols-4 gap-1"
                          role="meter"
                          aria-label="비밀번호 보안 강도"
                          aria-valuemin={0}
                          aria-valuemax={4}
                          aria-valuenow={strength.score}
                          aria-valuetext={strength.label}
                        >
                          {([1, 2, 3, 4] as const).map((step) => (
                            <span
                              key={step}
                              className={[
                                "h-1.5 rounded-full transition-colors duration-mu-fast",
                                strength.score >= step
                                  ? STRENGTH_BAR[level]
                                  : "bg-mu-sunken",
                              ].join(" ")}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })()
                : null}

              {mode === "signup" ? (
                <ul
                  className="grid grid-cols-2 gap-x-2 gap-y-1"
                  aria-label="비밀번호 규칙"
                >
                  {strength.rules.map((rule) => (
                    <li
                      key={rule.id}
                      className={[
                        "flex items-center gap-1.5 text-xs",
                        rule.ok
                          ? "font-semibold text-mu-ok"
                          : "text-ink-caption",
                      ].join(" ")}
                    >
                      {rule.ok ? (
                        <Check
                          className="h-3.5 w-3.5 shrink-0"
                          strokeWidth={2.5}
                          aria-hidden
                        />
                      ) : (
                        <span
                          className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-mu-line"
                          aria-hidden
                        />
                      )}
                      {rule.label}
                    </li>
                  ))}
                </ul>
              ) : null}

              {passwordInvalid ? (
                <span id={`${passwordId}-err`} className="text-xs text-danger">
                  {mode === "signup"
                    ? "비밀번호 규칙을 모두 채워 주세요."
                    : "비밀번호는 6자 이상이에요."}
                </span>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              aria-busy={busy}
              className="relative mt-0.5 flex min-h-touch w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-brand text-sm font-bold text-surface-white transition-transform active:scale-99 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              {busy
                ? "확인 중…"
                : mode === "signup"
                  ? "가입하기"
                  : "로그인"}
            </button>
          </>
        ) : null}
      </div>
    </form>
  );
}
