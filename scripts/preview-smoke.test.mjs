import { describe, expect, it, vi } from "vitest";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { runSmoke, usage } from "./preview-smoke.mjs";

const script = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "preview-smoke.mjs"
);

describe("preview-smoke.mjs", () => {
  it("DEMO_BASE_URL 없으면 사용법을 출력하고 종료 코드 1", () => {
    const result = spawnSync(process.execPath, [script], {
      encoding: "utf8",
      env: { ...process.env, DEMO_BASE_URL: "" },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/DEMO_BASE_URL/);
    expect(`${result.stdout}${result.stderr}`).not.toMatch(/eyJ|Bearer |sk-/);
  });

  it("usage 문구에 실제 비밀값을 넣지 않아요", () => {
    expect(usage()).toMatch(/DEMO_BASE_URL/);
    expect(usage()).not.toMatch(/eyJ|sk-|Bearer |password=/i);
  });

  it("상태코드만 남기고 본문·헤더·토큰은 출력하지 않아요", async () => {
    const secretBody = JSON.stringify({
      token: "secret-token-value",
      Authorization: "Bearer leak",
    });
    const fetchImpl = vi.fn(async (input) => {
      const url = String(input);
      let status = 200;
      if (url.includes("/api/agent/demo/seed")) status = 401;
      if (url.includes("/api/agent/automation-status")) status = 401;
      return new Response(secretBody, {
        status,
        headers: {
          "set-cookie": "session=leaked",
          "x-secret": "nope",
        },
      });
    });

    const lines = [];
    const result = await runSmoke({
      base: "https://preview.example",
      fetchImpl,
      log: (line) => lines.push(line),
    });

    expect(result.ok).toBe(true);
    const out = lines.join("\n");
    expect(out).toMatch(/PASS\tlogin\t200/);
    expect(out).toMatch(/demo-mode=on/);
    expect(out).not.toMatch(/secret-token-value/);
    expect(out).not.toMatch(/Bearer leak/);
    expect(out).not.toMatch(/session=leaked/);
    expect(out).not.toMatch(/x-secret/);
    expect(out).not.toMatch(/set-cookie/i);
  });

  it("join 이 login 으로 리다이렉트되면 실패해요", async () => {
    const fetchImpl = vi.fn(async (input) => {
      const url = String(input);
      if (url.includes("/join/")) {
        return new Response(null, {
          status: 307,
          headers: { location: "/login" },
        });
      }
      let status = 200;
      if (url.includes("/api/agent/demo/seed")) status = 404;
      if (url.includes("/api/agent/automation-status")) status = 401;
      return new Response("{}", { status });
    });

    const result = await runSmoke({
      base: "https://preview.example",
      fetchImpl,
      log: () => undefined,
    });
    expect(result.ok).toBe(false);
    expect(result.lines.some((l) => l.includes("join-public") && l.startsWith("FAIL"))).toBe(
      true
    );
  });
});
