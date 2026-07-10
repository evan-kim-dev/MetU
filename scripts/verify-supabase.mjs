#!/usr/bin/env node
/**
 * Verify Supabase tables + auth reachability.
 * Usage: npm run db:verify
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadBackendEnv() {
  const vars = {};
  try {
    for (const line of readFileSync(join(root, "backend", ".env"), "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      vars[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
    }
  } catch {
    /* ignore */
  }
  return vars;
}

const TABLES = [
  { name: "profiles", select: "id" },
  { name: "trips", select: "id" },
  { name: "community_posts", select: "id" },
  { name: "post_comments", select: "id" },
  { name: "post_likes", select: "post_id" },
  { name: "party_members", select: "post_id" },
  { name: "party_chat_messages", select: "id" },
  { name: "trip_plans", select: "id" },
  { name: "budget_insight_logs", select: "id" },
];

const env = loadBackendEnv();
const url = env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("backend/.env 에 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.");
  process.exit(1);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
};

let failed = 0;

for (const table of TABLES) {
  const res = await fetch(`${url}/rest/v1/${table.name}?select=${table.select}&limit=1`, { headers });
  if (res.ok) {
    console.log(`✓ ${table.name}`);
  } else {
    failed += 1;
    console.log(`✗ ${table.name} (${res.status})`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} table(s) missing — run: npm run db:push`);
  process.exit(1);
}

console.log("\nAll core tables are reachable.");
