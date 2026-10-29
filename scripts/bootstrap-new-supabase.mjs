#!/usr/bin/env node
/**
 * One-shot: write env for project ref + patch apply script.
 * Does not print secrets.
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ref = process.argv[2] || "jlcdewbwbtfwasnpqfcj";
const url = `https://${ref}.supabase.co`;
const pwdPath = join(tmpdir(), "metu_db_pwd.txt");
const pwd = readFileSync(pwdPath, "utf8").trim();

const keys = JSON.parse(
  execSync(`npx supabase projects api-keys --project-ref ${ref} --output json`, {
    encoding: "utf8",
  })
);
const anon = keys.find((k) => k.name === "anon")?.api_key;
const service = keys.find((k) => k.name === "service_role")?.api_key;
if (!anon || !service) throw new Error("missing api keys");

function upsertEnv(path, map) {
  let text = existsSync(path) ? readFileSync(path, "utf8") : "";
  for (const [k, v] of Object.entries(map)) {
    const re = new RegExp(`^${k}=.*$`, "m");
    if (re.test(text)) text = text.replace(re, `${k}=${v}`);
    else {
      if (text.length && !text.endsWith("\n")) text += "\n";
      text += `${k}=${v}\n`;
    }
  }
  writeFileSync(path, text);
  console.log("updated", path.slice(root.length + 1));
}

upsertEnv(join(root, ".env.local"), {
  NEXT_PUBLIC_SUPABASE_URL: url,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: anon,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: anon,
  SUPABASE_URL: url,
  SUPABASE_SERVICE_ROLE_KEY: service,
});

upsertEnv(join(root, "backend", ".env"), {
  SUPABASE_URL: url,
  SUPABASE_SERVICE_ROLE_KEY: service,
  SUPABASE_DB_PASSWORD: pwd,
  DB_PASSWORD: pwd,
  DB_HOST: "aws-1-ap-northeast-2.pooler.supabase.com",
  DB_PORT: "5432",
  DB_NAME: "postgres",
  DB_USER: `postgres.${ref}`,
});

let cfg = readFileSync(join(root, "supabase", "config.toml"), "utf8");
cfg = cfg.replace(/project_id\s*=\s*".*?"/, `project_id = "${ref}"`);
writeFileSync(join(root, "supabase", "config.toml"), cfg);
console.log("config.toml project_id ->", ref);

let push = readFileSync(
  join(root, "scripts", "apply-supabase-migrations.mjs"),
  "utf8"
);
push = push.replace(
  /const PROJECT_REF = ".*?"/,
  `const PROJECT_REF = "${ref}"`
);
push = push.replace(
  /aws-\d-ap-southeast-1\.pooler\.supabase\.com/g,
  "aws-1-ap-northeast-2.pooler.supabase.com"
);
// keep both pooler candidates in connectionUrls
if (!push.includes("aws-0-ap-northeast-2")) {
  push = push.replace(
    "aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres`,",
    `aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres\`,
  \`postgresql://postgres.\${PROJECT_REF}:\${encodeURIComponent(dbPassword)}@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres\`,`
  );
}
writeFileSync(
  join(root, "scripts", "apply-supabase-migrations.mjs"),
  push
);
console.log("apply script retargeted");
console.log("ref=", ref);
console.log("url=", url);
