import { describe, expect, it } from "vitest";
import { toUserFacingError } from "@/lib/errors/user-message";

describe("toUserFacingError", () => {
  it("maps network", () => {
    const e = toUserFacingError({
      source: "network",
      message: "Failed to fetch Supabase JWT postgres",
    });
    expect(e.code).toBe("network");
    expect(e.message).not.toMatch(/Supabase|postgres|JWT|Failed to fetch/i);
  });

  it("maps session expired", () => {
    expect(
      toUserFacingError({ source: "api", status: 401 }).code
    ).toBe("session-expired");
  });

  it("maps ingest unauthorized", () => {
    expect(
      toUserFacingError({ source: "ingest", status: 401 }).code
    ).toBe("unauthorized-code");
  });

  it("maps forbidden", () => {
    expect(toUserFacingError({ source: "api", status: 403 }).code).toBe(
      "forbidden"
    );
  });

  it("maps text_or_body_required", () => {
    const e = toUserFacingError({
      source: "ingest",
      status: 400,
      body: {
        error: "validation-failed",
        detail: { fieldErrors: { text: ["text_or_body_required"] } },
      },
    });
    expect(e.code).toBe("text-or-body-required");
    expect(e.action).toBe("open-guide");
  });

  it("maps receivedAt format", () => {
    expect(
      toUserFacingError({
        source: "ingest",
        status: 400,
        body: {
          error: "validation-failed",
          detail: { fieldErrors: { receivedAt: ["invalid"] } },
        },
      }).code
    ).toBe("received-at-format");
  });

  it("maps validation other", () => {
    expect(
      toUserFacingError({
        source: "ingest",
        status: 400,
        body: { error: "validation-failed", detail: { fieldErrors: {} } },
      }).code
    ).toBe("validation");
  });

  it("maps invalid-json", () => {
    expect(
      toUserFacingError({
        source: "ingest",
        status: 400,
        body: { error: "invalid-json" },
      }).code
    ).toBe("invalid-json");
  });

  it("maps payload-too-large", () => {
    expect(
      toUserFacingError({ source: "ingest", status: 413 }).code
    ).toBe("payload-too-large");
  });

  it("maps rate-limited with Retry-After", () => {
    const e = toUserFacingError({
      source: "api",
      status: 429,
      retryAfterHeader: "30",
    });
    expect(e.code).toBe("rate-limited");
    expect(e.retryAfterSec).toBe(30);
    expect(e.message).toContain("30초");
  });

  it("maps rate-limited default 60", () => {
    expect(
      toUserFacingError({ source: "api", status: 429 }).retryAfterSec
    ).toBe(60);
  });

  it("maps server-misconfigured", () => {
    expect(
      toUserFacingError({
        source: "api",
        status: 503,
        body: { error: "server-misconfigured" },
      }).code
    ).toBe("server-misconfigured");
  });

  it("maps server-error with operatorHint", () => {
    const e = toUserFacingError({
      source: "api",
      status: 500,
      body: { hint: "run migration" },
      message: "postgres boom",
    });
    expect(e.code).toBe("server-error");
    expect(e.operatorHint).toBe("run migration");
    expect(e.message).not.toMatch(/postgres/i);
  });

  it("maps supabase auth cases", () => {
    expect(
      toUserFacingError({
        source: "supabase-auth",
        message: "Invalid login credentials",
      }).code
    ).toBe("invalid-credentials");
    expect(
      toUserFacingError({
        source: "supabase-auth",
        message: "Email not confirmed",
      }).code
    ).toBe("email-not-confirmed");
    expect(
      toUserFacingError({
        source: "supabase-auth",
        message: "User already registered",
      }).code
    ).toBe("already-registered");
    expect(
      toUserFacingError({
        source: "supabase-auth",
        message: "Password should be at least 6 characters",
      }).code
    ).toBe("weak-password");
    expect(
      toUserFacingError({
        source: "supabase-auth",
        message: "over_email_send_rate_limit",
      }).code
    ).toBe("email-rate-limited");
  });

  it("maps oauth query", () => {
    expect(
      toUserFacingError({ source: "oauth-query", message: "access_denied" })
        .code
    ).toBe("oauth-cancelled");
    expect(
      toUserFacingError({ source: "oauth-query", message: "server_error" }).code
    ).toBe("oauth-failed");
  });

  it("never leaks raw message into output", () => {
    const e = toUserFacingError({
      source: "unknown",
      message: "Supabase JWT postgres internal",
    });
    expect(e.message).not.toMatch(/Supabase|JWT|postgres/i);
  });
});
