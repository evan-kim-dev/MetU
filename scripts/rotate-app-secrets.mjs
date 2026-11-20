#!/usr/bin/env node
/**
 * Rotate app-owned secrets (no external dashboard required).
 * Updates .env.local + Vercel (production/preview/development).
 * Does NOT print secret values.
 *
 * Rotates: GUEST_COOKIE_SECRET, CRON_SECRET, AGENT_INGEST_PEPPER,
 *          INTERNAL_API_SECRET, VAPID pair (if web-push available).
 *
 * Does NOT rotate: OPENAI_API_KEY, SUPABASE_*, DB_PASSWORD, map API keys
 * (need provider dashboard).
 *
 * Usage: node scripts/rotate-app-secrets.mjs
 */
import { execFileSync } from "node:child_process";
import { randomBytes, createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const environments = "production,preview,development";

function randSecret(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

function upsertLocalEnv(path, updates) {
  if (!existsSync(path)) {
    const lines = Object.entries(updates).map(([k, v]) => `${k}=${v}`);
    writeFileSync(path, `${lines.join("\n")}\n`, { mode: 0o600 });
    return Object.keys(updates);
  }
  const raw = readFileSync(path, "utf8");
  const lines = raw.split(/\r?\n/);
  const seen = new Set();
  const out = lines.map((line) => {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    if (!m) return line;
    const key = m[1];
    if (!(key in updates)) return line;
    seen.add(key);
    return `${key}=${updates[key]}`;
  });
  for (const [key, value] of Object.entries(updates)) {
    if (!seen.has(key)) out.push(`${key}=${value}`);
  }
  while (out.length && out[out.length - 1] === "") out.pop();
  writeFileSync(path, `${out.join("\n")}\n`, { mode: 0o600 });
  return Object.keys(updates);
}

function vercelEnvAdd(key, value, { sensitive }) {
  const tmp = join(tmpdir(), `vercel-env-${randomBytes(8).toString("hex")}`);
  writeFileSync(tmp, value, { encoding: "utf8", mode: 0o600 });
  try {
    const args = [
      "vercel",
      "env",
      "add",
      key,
      "--environment",
      environments,
      "--force",
      "--yes",
      sensitive ? "--sensitive" : "--no-sensitive",
    ];
    execFileSync("npx.cmd", args, {
      cwd: root,
      stdio: ["pipe", "pipe", "pipe"],
      input: readFileSync(tmp),
      encoding: "utf8",
      shell: true,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // fallback: PowerShell pipe without echoing value
    try {
      execFileSync(
        "powershell.exe",
        [
          "-NoProfile",
          "-Command",
          `Get-Content -Raw -LiteralPath '${tmp}' | npx vercel env add ${key} --environment ${environments} --force --yes ${sensitive ? "--sensitive" : "--no-sensitive"}`,
        ],
        { cwd: root, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" }
      );
    } catch (err2) {
      const msg2 = err2 instanceof Error ? err2.message : String(err2);
      throw new Error(`vercel env add failed for ${key}: ${msg}; ${msg2}`);
    }
  } finally {
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

async function maybeVapid() {
  try {
    const webpush = (await import("web-push")).default;
    const keys = webpush.generateVAPIDKeys();
    return {
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: keys.publicKey,
      VAPID_PRIVATE_KEY: keys.privateKey,
    };
  } catch {
    console.log("skip VAPID (web-push unavailable)");
    return null;
  }
}

const updates = {
  GUEST_COOKIE_SECRET: randSecret(32),
  CRON_SECRET: randSecret(32),
  AGENT_INGEST_PEPPER: randSecret(32),
  INTERNAL_API_SECRET: randSecret(32),
};

const vapid = await maybeVapid();
if (vapid) Object.assign(updates, vapid);

const localPath = join(root, ".env.local");
const changedLocal = upsertLocalEnv(localPath, updates);
console.log(`updated .env.local keys: ${changedLocal.join(", ")}`);

const fingerprint = createHash("sha256")
  .update(Object.values(updates).join("|"))
  .digest("hex")
  .slice(0, 12);
console.log(`rotation fingerprint (not a secret): ${fingerprint}`);

const sensitiveKeys = new Set([
  "GUEST_COOKIE_SECRET",
  "CRON_SECRET",
  "AGENT_INGEST_PEPPER",
  "INTERNAL_API_SECRET",
  "VAPID_PRIVATE_KEY",
]);

for (const [key, value] of Object.entries(updates)) {
  const sensitive = sensitiveKeys.has(key);
  process.stdout.write(`vercel ← ${key} ... `);
  vercelEnvAdd(key, value, { sensitive });
  console.log("ok");
}

console.log("");
console.log("Rotated app secrets on Vercel + .env.local.");
console.log("Side effects:");
console.log("- GUEST_COOKIE_SECRET: existing guest cookies invalidate");
console.log("- AGENT_INGEST_PEPPER: existing ingest tokens stop working");
console.log("- VAPID: push subscriptions need re-opt-in");
console.log("Still rotate manually: OPENAI_API_KEY, SUPABASE_SERVICE_ROLE_KEY,");
console.log("  NEXT_PUBLIC_SUPABASE_ANON_KEY, DB_PASSWORD, map API keys");
console.log("Redeploy required: npx vercel --prod  (or merge/redeploy main)");
