import {
  toUserFacingError,
  type UserFacingError,
} from "@/lib/errors/user-message";

export type CallbackErrorCode =
  | "access_denied"
  | "missing_code"
  | "exchange_failed"
  | "unknown";

/** Map callback / query error values to a fixed code (never pass raw messages in URLs). */
export function callbackErrorCode(input: unknown): CallbackErrorCode {
  if (input == null) return "unknown";
  const value = String(input).trim();
  if (!value) return "unknown";

  const lower = value.toLowerCase();
  if (lower === "access_denied") return "access_denied";
  if (lower === "missing_code") return "missing_code";
  if (lower === "exchange_failed") return "exchange_failed";

  if (/unable to exchange|exchange external code|invalid grant/i.test(value)) {
    return "exchange_failed";
  }

  if (value.length > 32 || value.includes(" ") || value.includes(":")) {
    return "exchange_failed";
  }

  return "unknown";
}

export function callbackErrorToUserFacing(
  code: CallbackErrorCode
): UserFacingError {
  if (code === "access_denied") {
    return toUserFacingError({
      source: "oauth-query",
      message: "access_denied",
    });
  }
  return toUserFacingError({
    source: "oauth-query",
    message: "server_error",
  });
}
