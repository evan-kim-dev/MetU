export type ErrorSource =
  | "api"
  | "ingest"
  | "supabase-auth"
  | "oauth-query"
  | "network"
  | "unknown";

export type UserFacingAction =
  | "retry"
  | "login"
  | "open-guide"
  | "reissue-code"
  | "switch-to-login"
  | "resend-confirm";

export interface UserFacingError {
  code: string;
  message: string;
  retryable: boolean;
  retryAfterSec?: number;
  action?: UserFacingAction;
  operatorHint?: string;
}

type BodyShape = {
  error?: unknown;
  detail?: unknown;
  hint?: unknown;
  message?: unknown;
};

function asRecord(body: unknown): BodyShape {
  if (body && typeof body === "object") return body as BodyShape;
  return {};
}

function fieldErrorsText(detail: unknown): string {
  if (!detail || typeof detail !== "object") return "";
  const fe = (detail as { fieldErrors?: Record<string, unknown> }).fieldErrors;
  if (!fe || typeof fe !== "object") return "";
  return Object.values(fe)
    .flatMap((v) => (Array.isArray(v) ? v : [v]))
    .map((v) => String(v))
    .join(" ");
}

function fieldErrorKeys(detail: unknown): string[] {
  if (!detail || typeof detail !== "object") return [];
  const fe = (detail as { fieldErrors?: Record<string, unknown> }).fieldErrors;
  if (!fe || typeof fe !== "object") return [];
  return Object.keys(fe);
}

function parseRetryAfter(header: string | null | undefined): number {
  if (!header) return 60;
  const n = Number(header);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  return 60;
}

function looksLikeNetwork(message?: string): boolean {
  if (!message) return false;
  return /failed to fetch|networkerror|network request failed|load failed|abort/i.test(
    message
  );
}

function mapSupabaseAuth(message: string): UserFacingError | null {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return {
      code: "invalid-credentials",
      message: "이메일 또는 비밀번호가 맞지 않아요.",
      retryable: false,
    };
  }
  if (m.includes("email not confirmed")) {
    return {
      code: "email-not-confirmed",
      message:
        "이메일 확인이 아직이에요. 받은 편지함의 확인 메일을 눌러 주세요.",
      retryable: false,
      action: "resend-confirm",
    };
  }
  if (m.includes("user already registered") || m.includes("already been registered")) {
    return {
      code: "already-registered",
      message: "이미 가입된 이메일이에요. 로그인해 주세요.",
      retryable: false,
      action: "switch-to-login",
    };
  }
  if (m.includes("password should be at least") || m.includes("weak_password") || m.includes("weak password")) {
    return {
      code: "weak-password",
      message: "비밀번호는 6자 이상으로 만들어 주세요.",
      retryable: false,
    };
  }
  if (m.includes("over_email_send_rate_limit") || m.includes("email rate limit")) {
    return {
      code: "email-rate-limited",
      message: "메일을 너무 자주 보냈어요. 잠시 뒤 다시 시도해 주세요.",
      retryable: true,
      action: "retry",
    };
  }
  return null;
}

function mapOauthQuery(message: string): UserFacingError {
  if (message.toLowerCase() === "access_denied") {
    return {
      code: "oauth-cancelled",
      message: "로그인을 취소했어요.",
      retryable: false,
    };
  }
  return {
    code: "oauth-failed",
    message: "로그인을 끝내지 못했어요. 다시 시도해 주세요.",
    retryable: true,
    action: "retry",
  };
}

/**
 * Map any error source to a fixed Korean user-facing message.
 * Never embeds raw input strings in `message`.
 */
export function toUserFacingError(input: {
  source: ErrorSource;
  status?: number;
  body?: unknown;
  message?: string;
  retryAfterHeader?: string | null;
}): UserFacingError {
  const { source, status, body, message, retryAfterHeader } = input;
  const rec = asRecord(body);
  const errorCode = typeof rec.error === "string" ? rec.error : "";
  const hint = typeof rec.hint === "string" ? rec.hint : undefined;

  if (
    source === "network" ||
    looksLikeNetwork(message) ||
    (typeof navigator !== "undefined" && navigator.onLine === false)
  ) {
    return {
      code: "network",
      message:
        "인터넷에 연결되어 있지 않아요. 연결을 확인하고 다시 시도해 주세요.",
      retryable: true,
      action: "retry",
    };
  }

  if (source === "oauth-query") {
    return mapOauthQuery(message ?? errorCode);
  }

  if (source === "supabase-auth") {
    const mapped = mapSupabaseAuth(message ?? "");
    if (mapped) return mapped;
  }

  if (status === 401 && source === "ingest") {
    return {
      code: "unauthorized-code",
      message:
        "연결 코드가 올바르지 않거나 새로 만들어서 사용이 중지됐어요. 새 코드를 단축어에 넣어 주세요.",
      retryable: false,
      action: "reissue-code",
    };
  }

  if (status === 401 && (source === "api" || source === "unknown")) {
    return {
      code: "session-expired",
      message: "로그인이 만료됐어요. 다시 로그인해 주세요.",
      retryable: false,
      action: "login",
    };
  }

  if (status === 403) {
    return {
      code: "forbidden",
      message: "이 작업을 할 권한이 없어요.",
      retryable: false,
    };
  }

  if (status === 413) {
    return {
      code: "payload-too-large",
      message: "알림 내용이 너무 길어요(최대 2,000자).",
      retryable: false,
    };
  }

  if (status === 429) {
    const n = parseRetryAfter(retryAfterHeader);
    return {
      code: "rate-limited",
      message: `요청이 너무 많아요. ${n}초 뒤에 다시 시도해 주세요.`,
      retryable: true,
      retryAfterSec: n,
      action: "retry",
    };
  }

  if (status === 400 && errorCode === "invalid-json") {
    return {
      code: "invalid-json",
      message:
        '보낸 데이터가 올바른 JSON이 아니에요. 따옴표(")와 쉼표를 확인해 주세요.',
      retryable: false,
    };
  }

  if (status === 400 && errorCode === "validation-failed") {
    const joined = fieldErrorsText(rec.detail);
    const keys = fieldErrorKeys(rec.detail);
    if (/text_or_body_required/i.test(joined)) {
      return {
        code: "text-or-body-required",
        message:
          "보낼 알림 내용이 비어 있어요. 단축어 입력에 '알림 › 본문' 변수를 넣었는지 확인해 주세요. (직접 실행했다면 정상이에요)",
        retryable: false,
        action: "open-guide",
      };
    }
    if (keys.includes("receivedAt") || keys.includes("received_at")) {
      return {
        code: "received-at-format",
        message:
          "시간 형식이 올바르지 않아요. 시간대가 포함된 형식(예: 2026-10-31T12:00:00+09:00)으로 보내거나 시각 항목을 지워 주세요.",
        retryable: false,
        action: "open-guide",
      };
    }
    return {
      code: "validation",
      message:
        "보낸 내용이 형식에 맞지 않아요. 앱과 알림 본문이 비어 있지 않은지 확인해 주세요.",
      retryable: false,
    };
  }

  if (status === 503 || errorCode === "server-misconfigured") {
    return {
      code: "server-misconfigured",
      message:
        "서버 설정이 아직 끝나지 않았어요. 잠시 뒤 다시 시도하거나 운영자에게 알려 주세요.",
      retryable: true,
      action: "retry",
    };
  }

  if (typeof status === "number" && status >= 500) {
    return {
      code: "server-error",
      message: "서버에 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.",
      retryable: true,
      action: "retry",
      operatorHint: hint,
    };
  }

  if (source === "supabase-auth" && message) {
    const mapped = mapSupabaseAuth(message);
    if (mapped) return mapped;
  }

  return {
    code: "unknown",
    message: "문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.",
    retryable: true,
    action: "retry",
  };
}
