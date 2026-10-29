import { describe, expect, it } from "vitest";

import { readJsonLimited } from "@/lib/agent/body-limit";

describe("readJsonLimited", () => {
  it("rejects bodies over 8KB", async () => {
    const oversized = JSON.stringify({ text: "x".repeat(9000) });
    const req = new Request("http://localhost/api/ingest/sms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: oversized,
    });
    const result = await readJsonLimited(req, 8_192);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(413);
  });

  it("parses bodies under the limit", async () => {
    const req = new Request("http://localhost/api/ingest/sms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "승인 1000원" }),
    });
    const result = await readJsonLimited(req, 8_192);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.json).toEqual({ text: "승인 1000원" });
    }
  });
});
