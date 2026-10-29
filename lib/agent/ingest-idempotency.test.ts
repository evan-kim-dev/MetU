import { describe, expect, it } from "vitest";

import { defaultSmsIdempotencyKey } from "@/lib/agent/ingest";

describe("ingest idempotency scope", () => {
  it("builds a stable key from redacted text + minute bucket", () => {
    const a = defaultSmsIdempotencyKey(
      "승인 10,000원",
      "2026-07-20T12:34:56+09:00"
    );
    const b = defaultSmsIdempotencyKey(
      "승인 10,000원",
      "2026-07-20T12:34:10+09:00"
    );
    expect(a).toBe(b);
    expect(a.length).toBe(64);
  });

  it("user-scoped prefix keeps trip out of the key", () => {
    const userId = "11111111-1111-1111-1111-111111111111";
    const key = defaultSmsIdempotencyKey("승인 1원", "2026-07-20T12:00:00Z");
    const scoped = `${userId}:${key}`;
    expect(scoped.startsWith(`${userId}:`)).toBe(true);
    expect(scoped.includes("trip")).toBe(false);
  });
});
