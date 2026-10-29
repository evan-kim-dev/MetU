import { afterEach, describe, expect, it } from "vitest";

import { requireCronSecret } from "@/lib/security/guard";

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe("requireCronSecret", () => {
  it("returns 503 when secret missing", () => {
    delete process.env.CRON_SECRET;
    const res = requireCronSecret(
      new Request("http://localhost/api/agent/sweep", {
        headers: { authorization: "Bearer x" },
      })
    );
    expect(res).toBeInstanceOf(Response);
    if (res instanceof Response) expect(res.status).toBe(503);
  });

  it("returns 401 on wrong bearer", () => {
    process.env.CRON_SECRET = "expected-secret";
    const res = requireCronSecret(
      new Request("http://localhost/api/agent/sweep", {
        headers: { authorization: "Bearer wrong" },
      })
    );
    expect(res).toBeInstanceOf(Response);
    if (res instanceof Response) expect(res.status).toBe(401);
  });

  it("accepts matching bearer", () => {
    process.env.CRON_SECRET = "expected-secret";
    const res = requireCronSecret(
      new Request("http://localhost/api/agent/sweep", {
        headers: { authorization: "Bearer expected-secret" },
      })
    );
    expect(res).toEqual({ ok: true });
  });
});
