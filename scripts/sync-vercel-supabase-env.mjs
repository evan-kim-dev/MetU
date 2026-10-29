#!/usr/bin/env node
/**
 * Upsert Supabase-related env vars to linked Vercel project from .env.local.
 * Does not print secret values.
 */
import { execFileSync, execSync } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

function vercelBin() {
  const cmd = process.platform === "win32" ? "npx.cmd" : "npx";
  return cmd;
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv(path) {
  const vars = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    vars[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return vars;
}

const local = loadEnv(join(root, ".env.local"));
const pairs = [
  ["NEXT_PUBLIC_SUPABASE_URL", false],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", false],
  ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", false],
  ["NEXT_PUBLIC_SITE_URL", false],
  ["SUPABASE_URL", true],
  ["SUPABASE_SERVICE_ROLE_KEY", true],
];

const environments = "production,preview,development";

for (const [key, sensitive] of pairs) {
  let value = local[key];
  if (key === "NEXT_PUBLIC_SITE_URL" && !value) {
    value = "https://met-u.vercel.app";
  }
  if (!value) {
    console.log(`skip ${key}`);
    continue;
  }

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
    ];
    if (sensitive) args.push("--sensitive");
    else args.push("--no-sensitive");

    const bin = vercelBin();
    try {
      execFileSync(bin, args, {
        cwd: root,
        stdio: ["pipe", "pipe", "pipe"],
        input: readFileSync(tmp),
        encoding: "utf8",
        shell: process.platform === "win32",
      });
    } catch {
      // fallback: shell pipe
      const flags = [
        "vercel",
        "env",
        "add",
        key,
        "--environment",
        environments,
        "--force",
        "--yes",
        sensitive ? "--sensitive" : "--no-sensitive",
      ].join(" ");
      execSync(`Get-Content -Raw '${tmp}' | ${bin} ${flags}`, {
        cwd: root,
        shell: "powershell.exe",
        stdio: ["ignore", "pipe", "pipe"],
        encoding: "utf8",
      });
    }
    console.log(`ok ${key}`);
  } catch (err) {
    const msg = err?.stderr?.toString?.() || err?.message || String(err);
    console.error(`fail ${key}:`, msg.slice(0, 300));
    process.exitCode = 1;
  } finally {
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

console.log("env sync done");
