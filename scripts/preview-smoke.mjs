/**
 * Preview URL smoke: status codes only. No tokens, no response bodies.
 * Env: DEMO_BASE_URL (required)
 */

export function usage() {
  return [
    "Usage: DEMO_BASE_URL=<url> npm run smoke:preview",
    "Env required:",
    "  DEMO_BASE_URL  e.g. https://example.vercel.app",
    "Prints status codes only. Never prints bodies, headers, or secrets.",
  ].join("\n");
}

/** @typedef {{ name: string; method?: string; path: string; expect: (status: number, redirected: boolean, finalUrl: string) => string | null }} SmokeCheck */

/** @type {SmokeCheck[]} */
export const CHECKS = [
  {
    name: "warmup",
    path: "/api/warmup",
    expect: (status) =>
      status >= 200 && status < 500 ? null : `unexpected ${status}`,
  },
  {
    name: "login",
    path: "/login",
    expect: (status) => (status === 200 ? null : `expected 200 got ${status}`),
  },
  {
    name: "join-public",
    path: "/join/invalid-token",
    expect: (status, redirected, finalUrl) => {
      if (redirected && /\/login/i.test(finalUrl)) {
        return "redirected to login (join must stay public)";
      }
      if (status >= 200 && status < 400) return null;
      return `unexpected ${status}`;
    },
  },
  {
    name: "share-public",
    path: "/s/invalid-token",
    expect: (status) =>
      status >= 200 && status < 400 ? null : `unexpected ${status}`,
  },
  {
    name: "demo-seed",
    method: "POST",
    path: "/api/agent/demo/seed",
    expect: (status) => {
      if (status === 401 || status === 404) return null;
      return `expected 401|404 got ${status}`;
    },
  },
  {
    name: "protected-api",
    path: "/api/agent/automation-status",
    expect: (status) =>
      status === 401 ? null : `expected 401 got ${status}`,
  },
];

/**
 * @param {{ base: string; fetchImpl?: typeof fetch; log?: (line: string) => void }} opts
 * @returns {Promise<{ ok: boolean; lines: string[] }>}
 */
export async function runSmoke(opts) {
  const base = opts.base.replace(/\/$/, "");
  const fetchImpl = opts.fetchImpl ?? fetch;
  const log = opts.log ?? console.log;
  const lines = [];
  const say = (line) => {
    lines.push(line);
    log(line);
  };

  say(`smoke base=${base}`);
  let allOk = true;

  for (const check of CHECKS) {
    try {
      const url = `${base}${check.path}`;
      const method = check.method ?? "GET";
      const res = await fetchImpl(url, {
        method,
        redirect: "manual",
        headers:
          method === "POST"
            ? { "Content-Type": "application/json" }
            : undefined,
        body: method === "POST" ? "{}" : undefined,
      });

      const status = res.status;
      const redirected = status >= 300 && status < 400;
      const location = res.headers.get("location") ?? "";
      const finalUrl = redirected
        ? new URL(location, base).pathname
        : check.path;

      // Drain body without logging.
      if (typeof res.arrayBuffer === "function") {
        await res.arrayBuffer().catch(() => undefined);
      }

      const err = check.expect(status, redirected, finalUrl);
      let note = "";
      if (check.name === "demo-seed") {
        note =
          status === 401
            ? " demo-mode=on"
            : status === 404
              ? " demo-mode=off"
              : "";
      }
      const ok = !err;
      if (!ok) allOk = false;
      say(`${ok ? "PASS" : "FAIL"}\t${check.name}\t${status}\t${err ?? `ok${note}`}`);
    } catch (e) {
      allOk = false;
      const detail = e instanceof Error ? e.message : "fetch-failed";
      say(`FAIL\t${check.name}\t0\t${detail}`);
    }
  }

  return { ok: allOk, lines };
}

async function main() {
  const base = process.env.DEMO_BASE_URL?.replace(/\/$/, "");
  if (!base) {
    console.error(usage());
    process.exit(1);
  }
  const result = await runSmoke({ base });
  if (!result.ok) process.exit(1);
}

const isDirect =
  typeof process.argv[1] === "string" &&
  process.argv[1].replace(/\\/g, "/").endsWith("preview-smoke.mjs");

if (isDirect) {
  main();
}
