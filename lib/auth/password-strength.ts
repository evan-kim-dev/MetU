/**
 * 이메일 가입용 비밀번호 규칙·강도 (순수 함수).
 * 로그인은 기존 계정 호환을 위해 길이만 보고, 가입은 정책을 강제해요.
 */

export const PASSWORD_MIN_LOGIN = 6;
export const PASSWORD_MIN_SIGNUP = 8;

export type PasswordStrengthLevel =
  | "empty"
  | "danger"
  | "weak"
  | "fair"
  | "strong";

export type PasswordRuleId =
  | "minLength"
  | "letter"
  | "number"
  | "special";

export type PasswordRule = {
  id: PasswordRuleId;
  label: string;
  ok: boolean;
};

export type PasswordStrength = {
  level: PasswordStrengthLevel;
  /** 0=empty … 4=strong */
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  rules: PasswordRule[];
  meetsSignupPolicy: boolean;
  meetsLoginPolicy: boolean;
};

const LEVEL_LABEL: Record<PasswordStrengthLevel, string> = {
  empty: "",
  danger: "위험",
  weak: "약함",
  fair: "보통",
  strong: "안전",
};

export function evaluatePassword(password: string): PasswordStrength {
  const rules: PasswordRule[] = [
    {
      id: "minLength",
      label: `${PASSWORD_MIN_SIGNUP}자 이상`,
      ok: password.length >= PASSWORD_MIN_SIGNUP,
    },
    {
      id: "letter",
      label: "영문 포함",
      ok: /[A-Za-z]/.test(password),
    },
    {
      id: "number",
      label: "숫자 포함",
      ok: /\d/.test(password),
    },
    {
      id: "special",
      label: "특수문자 포함",
      ok: /[^A-Za-z0-9]/.test(password),
    },
  ];

  const okCount = rules.filter((r) => r.ok).length;
  const meetsSignupPolicy = okCount === rules.length;
  const meetsLoginPolicy = password.length >= PASSWORD_MIN_LOGIN;

  if (!password) {
    return {
      level: "empty",
      score: 0,
      label: LEVEL_LABEL.empty,
      rules,
      meetsSignupPolicy: false,
      meetsLoginPolicy: false,
    };
  }

  let level: PasswordStrengthLevel;
  let score: 0 | 1 | 2 | 3 | 4;

  if (okCount <= 1 || password.length < PASSWORD_MIN_LOGIN) {
    level = "danger";
    score = 1;
  } else if (okCount === 2) {
    level = "weak";
    score = 2;
  } else if (okCount === 3) {
    level = "fair";
    score = 3;
  } else {
    level = "strong";
    score = 4;
  }

  return {
    level,
    score,
    label: LEVEL_LABEL[level],
    rules,
    meetsSignupPolicy,
    meetsLoginPolicy,
  };
}

export function signupPasswordErrorMessage(password: string): string | null {
  const { meetsSignupPolicy, rules } = evaluatePassword(password);
  if (meetsSignupPolicy) return null;
  const missing = rules.filter((r) => !r.ok).map((r) => r.label);
  if (missing.length === 0) return "비밀번호를 더 안전하게 만들어 주세요.";
  return `비밀번호에 ${missing.join(", ")}이(가) 필요해요.`;
}
