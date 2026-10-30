import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const API_ROOT = join(process.cwd(), "app", "api");

/** Paths relative to app/api, posix-style. Document why each is exempt. */
const ALLOWLIST: Record<string, string> = {
  "auth/guest/route.ts": "issues signed guest cookie; must be public",
  "warmup/route.ts": "backend health probe for cold start; no user data",
  "fx/route.ts": "public FX read proxy (legacy); no write",
  "destination-image/route.ts": "public destination thumbnail proxy",
  "onboarding/session/route.ts": "onboarding bootstrap; guest-safe session mint",
  "trip-tips/route.ts": "legacy tips proxy; read-only",
  "account/delete/route.ts": "uses getUser() + service role; pre-guardApi pattern",
  "users/[id]/route.ts": "profile read with own getUser check",
  "users/batch/route.ts": "profile batch with own getUser check",
  "share-target/route.ts": "PWA share_target POST redirect; no secrets",
  "places/autocomplete/route.ts":
    "public Travelpayouts autocomplete proxy; IP rate-limited, no user data write",
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name === "route.ts") out.push(full);
  }
  return out;
}

describe("API route inventory", () => {
  it("every route uses a guard or is allowlisted", () => {
    const files = walk(API_ROOT);
    expect(files.length).toBeGreaterThan(10);

    const missing: string[] = [];
    for (const file of files) {
      const rel = relative(API_ROOT, file).replace(/\\/g, "/");
      if (ALLOWLIST[rel]) continue;
      const src = readFileSync(file, "utf8");
      const ok =
        src.includes("guardApi(") ||
        src.includes("requireIngestToken(") ||
        src.includes("requireCronSecret(");
      if (!ok) missing.push(rel);
    }

    expect(missing).toEqual([]);
  });

  it("SUPABASE_SERVICE_ROLE_KEY is only read in lib/agent/admin.ts", () => {
    const root = process.cwd();
    const hits: string[] = [];

    function scan(dir: string) {
      for (const name of readdirSync(dir)) {
        if (
          name === "node_modules" ||
          name === ".next" ||
          name === "dist" ||
          name === "coverage"
        ) {
          continue;
        }
        const full = join(dir, name);
        const st = statSync(full);
        if (st.isDirectory()) {
          scan(full);
          continue;
        }
        if (!/\.(ts|tsx|js|mjs|cjs)$/.test(name)) continue;
        const rel = relative(root, full).replace(/\\/g, "/");
        if (rel === "lib/agent/admin.ts") continue;
        if (rel.includes(".test.")) continue;
        const src = readFileSync(full, "utf8");
        if (src.includes("SUPABASE_SERVICE_ROLE_KEY")) hits.push(rel);
      }
    }

    scan(join(root, "lib"));
    scan(join(root, "app"));
    expect(hits).toEqual([]);
  });
});
