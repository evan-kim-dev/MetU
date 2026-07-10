#!/usr/bin/env node
/**
 * Remote Supabase migration push (PostgreSQL direct).
 *
 * Requires in backend/.env:
 *   SUPABASE_DB_PASSWORD=...  (Dashboard → Settings → Database)
 *
 * Usage: npm run db:push
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = join(root, "supabase", "migrations");
const envPath = join(root, "backend", ".env");

const PROJECT_REF = "yfpvgxbmxgpjuzmpnbia";

function loadEnv(path) {
  const vars = {};
  try {
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
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

const env = loadEnv(envPath);
const dbPassword =
  env.DB_PASSWORD || env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD;

if (!dbPassword) {
  console.error(
    "DB_PASSWORD 또는 SUPABASE_DB_PASSWORD 가 없습니다.\n" +
      "Supabase Dashboard → Settings → Database → Database password 를\n" +
      "backend/.env 에 DB_PASSWORD=... 로 추가한 뒤 다시 실행하세요."
  );
  process.exit(1);
}

const dbHost = env.DB_HOST || "aws-1-ap-southeast-1.pooler.supabase.com";
const dbPort = env.DB_PORT || "5432";
const dbName = env.DB_NAME || "postgres";
const dbUser = env.DB_USER || `postgres.${PROJECT_REF}`;

const connectionUrls = [
  `postgresql://${dbUser}:${encodeURIComponent(dbPassword)}@${dbHost}:${dbPort}/${dbName}`,
  `postgresql://postgres.${PROJECT_REF}:${encodeURIComponent(dbPassword)}@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres`,
  `postgresql://postgres.${PROJECT_REF}:${encodeURIComponent(dbPassword)}@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`,
];

const files = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

async function connect() {
  let lastError;
  for (const url of connectionUrls) {
    const client = new pg.Client({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
    });
    try {
      await client.connect();
      console.log(`Connected via ${url.replace(dbPassword, "***")}`);
      return client;
    } catch (error) {
      lastError = error;
      await client.end().catch(() => undefined);
    }
  }
  throw lastError;
}

async function main() {
  const client = await connect();

  try {
    await client.query("create schema if not exists supabase_migrations");
    await client.query(`
      create table if not exists supabase_migrations.schema_migrations (
        version text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    const applied = await client.query(
      "select version from supabase_migrations.schema_migrations"
    );
    const appliedSet = new Set(applied.rows.map((row) => row.version));

    console.log(`Applying ${files.length} migrations to ${PROJECT_REF}...`);

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`↷ skip ${file} (already applied)`);
        continue;
      }

      const sql = readFileSync(join(migrationsDir, file), "utf8");
      console.log(`→ ${file}`);
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query(
          "insert into supabase_migrations.schema_migrations(version) values ($1)",
          [file]
        );
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    }

    console.log("Done.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Migration failed:", error.message ?? error);
  process.exit(1);
});
