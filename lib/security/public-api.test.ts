import { describe, expect, it } from "vitest";

import { isPublicApiPath } from "@/lib/security/public-api";

describe("isPublicApiPath", () => {
  it("allows ingest and cron without session", () => {
    expect(isPublicApiPath("/api/ingest/sms")).toBe(true);
    expect(isPublicApiPath("/api/agent/sweep")).toBe(true);
    expect(isPublicApiPath("/api/agent/cron/daily")).toBe(true);
    expect(isPublicApiPath("/api/auth/guest")).toBe(true);
    expect(isPublicApiPath("/api/places/autocomplete")).toBe(true);
    expect(isPublicApiPath("/api/places/search")).toBe(false);
  });

  it("requires session for ledger and agent write APIs", () => {
    expect(isPublicApiPath("/api/ledger/fx")).toBe(false);
    expect(isPublicApiPath("/api/agent/tokens")).toBe(false);
    expect(isPublicApiPath("/api/events")).toBe(false);
  });
});
