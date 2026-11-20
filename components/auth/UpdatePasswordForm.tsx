"use client";

import { useId, useState, type FormEvent } from "react";
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

export interface UpdatePasswordFormProps {
  onUpdated?: () => void;
  className?: string;
}

export function UpdatePasswordForm({
  onUpdated,
  className = "",
}: UpdatePasswordFormProps) {
  const { updatePassword } = useAuthActions();
  const passwordId = useId();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<UserFacingError | null>(null);

  const strength = evaluatePassword(password);
  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit =
    strength.meetsSignupPolicy && password === confirm && !busy;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    setError(null);
    if (!canSubmit) return;

    setBusy(true);
    const result = await updatePassword(password);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onUpdated?.();
  };

  const fieldHeight =
    "min-h-11 w-full rounded-mu-lg border border-mu-line bg-mu-sunken px-3 text-sm text-mu-fg outline-none placeholder:text-mu-fg-3 focus:border-mu-accent/40 focus-visible:ring-2 focus-visible:ring-mu-accent/30 disabled:opacity-60";

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className={[
        "flex flex-col gap-2 rounded-mu-xl border border-mu-line bg-mu-card p-3 shadow-sm",
        className,
      ].join(" ")}
      noValidate
    >
      <div className="text-left">
        <p className="text-sm font-bold text-mu-fg">새 비밀번호 설정</p>
        <p className="mt-1 text-xs leading-5 text-mu-fg-2">
          재설정 메일로 오신 거예요. 새 비밀번호를 입력해 주세요.
        </p>
      </div>

      {error ? <AuthMessage kind="error">{error.message}</AuthMessage> : null}

      <div className="flex flex-col gap-1 text-left">
        <label
          htmlFor={passwordId}
          className="text-xs font-bold text-mu-fg-3"
        >
          새 비밀번호
        </label>
        <div className="relative">
          <input
            id={passwordId}
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setTouched(true)}
            disabled={busy}
            placeholder="8자 이상, 영문·숫자·특수문자"
            className={`${fieldHeight} pr-14`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-pressed={showPassword}
            aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 표시"}
            className="absolute right-0.5 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-mu-md px-2 text-xs font-bold text-mu-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mu-accent/40"
          >
            {showPassword ? "숨기기" : "표시"}
          </button>
        </div>
      </div>

      {password.length > 0 && strength.level !== "empty"
        ? (() => {
            const level = strength.level;
            return (
              <div className="flex flex-col gap-1.5" aria-live="polite">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-mu-fg-3">보안 강도</span>
                  <span
                    className={["text-xs font-bold", STRENGTH_TEXT[level]].join(
                      " "
                    )}
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

      <ul
        className="grid grid-cols-2 gap-x-2 gap-y-1"
        aria-label="비밀번호 규칙"
      >
        {strength.rules.map((rule) => (
          <li
            key={rule.id}
            className={[
              "flex items-center gap-1.5 text-xs",
              rule.ok ? "font-semibold text-mu-ok" : "text-mu-fg-3",
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

      <label
        htmlFor={`${passwordId}-confirm`}
        className="flex flex-col gap-1 text-left"
      >
        <span className="text-xs font-bold text-mu-fg-3">
          새 비밀번호 확인
        </span>
        <input
          id={`${passwordId}-confirm`}
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onBlur={() => setTouched(true)}
          disabled={busy}
          placeholder="비밀번호 다시 입력"
          aria-invalid={touched && mismatch}
          className={fieldHeight}
        />
        {touched && mismatch ? (
          <span className="text-xs text-mu-err">
            비밀번호가 서로 달라요.
          </span>
        ) : null}
      </label>

      <button
        type="submit"
        disabled={!canSubmit}
        aria-busy={busy}
        className="relative mt-0.5 flex min-h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-mu-lg bg-mu-accent text-sm font-bold text-mu-card transition-transform active:scale-99 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mu-accent/40"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {busy ? "저장 중…" : "비밀번호 저장"}
      </button>
    </form>
  );
}
