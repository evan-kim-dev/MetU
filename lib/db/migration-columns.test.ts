import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import {
  columnsFromMigrations,
  findSelectUsages,
  findUnknownColumns,
  listSourceFiles,
  loadMigrationSql,
  parseSelectColumns,
} from "@/lib/db/migration-columns";
import { readFileSync } from "node:fs";

const ROOT = process.cwd();
const MIGRATIONS = join(ROOT, "supabase", "migrations");

describe("columnsFromMigrations (파서)", () => {
  const sqlCreate = `
    create table if not exists public.trips (
      id uuid primary key default gen_random_uuid(),
      -- 주석 속 fake_col text
      user_id uuid not null references auth.users(id),
      status text not null check (status in ('a', 'b')),
      constraint trips_x check (id is not null),
      unique (user_id, status)
    );
    create table public.trips_archive (id uuid, only_in_archive text);
  `;
  const sqlAlter = `
    alter table public.trips
      add column if not exists start_date date,
      add column if not exists local_currency text;
    alter table public.trip_members add column role text;
    do $$ begin
      alter table public.trips add constraint c check (true);
    exception when duplicate_object then null; end $$;
  `;

  it("create table 의 컬럼만 뽑고 제약/주석은 제외해요", () => {
    const cols = columnsFromMigrations([sqlCreate], "trips");
    expect([...cols].sort()).toEqual(["id", "status", "user_id"]);
  });

  it("alter table add column 을 합치고 비슷한 이름의 다른 테이블은 섞지 않아요", () => {
    const cols = columnsFromMigrations([sqlCreate, sqlAlter], "trips");
    expect(cols.has("start_date")).toBe(true);
    expect(cols.has("local_currency")).toBe(true);
    expect(cols.has("role")).toBe(false);
    expect(cols.has("only_in_archive")).toBe(false);
    expect(cols.has("fake_col")).toBe(false);
  });

  it("drop / rename column 을 반영해요", () => {
    const cols = columnsFromMigrations(
      [
        sqlCreate,
        "alter table public.trips drop column status, rename column user_id to owner_id;",
      ],
      "trips"
    );
    expect(cols.has("status")).toBe(false);
    expect(cols.has("user_id")).toBe(false);
    expect(cols.has("owner_id")).toBe(true);
  });
});

describe("findSelectUsages (코드 쪽 파서)", () => {
  it("문자열 리터럴과 같은 파일의 const 를 풀고, * 와 관계 select 는 건너뛰어요", () => {
    const src = `
      const COLS = "id, start_date";
      a.from("trips")
        .select("id, user_id, currency")
        .eq("id", 1);
      b.from("trips").select(COLS);
      c.from("trips").select("*");
      d.from("trips").select("id, trip_members(id, user_id), s:start_date");
      e.from("other").select("nope");
    `;
    const usages = findSelectUsages(src, "trips", "x.ts");
    expect(usages.map((u) => u.columns)).toEqual([
      ["id", "user_id", "currency"],
      ["id", "start_date"],
      [],
      ["id", "start_date"],
    ]);
    expect(usages[0]!.line).toBe(3);
  });

  it("풀 수 없는 식별자는 unresolved 로 알려요", () => {
    const [u] = findSelectUsages(`x.from("trips").select(dynamicCols)`, "trips", "y.ts");
    expect(u!.unresolved).toContain("dynamicCols");
  });

  it("parseSelectColumns: 별칭/캐스트/관계", () => {
    expect(parseSelectColumns("id, s:start_date, n::text, rel(id, x), *")).toEqual([
      "id",
      "start_date",
      "n",
    ]);
  });
});

describe("trips: 마이그레이션 컬럼 allowlist vs .from(\"trips\").select(…)", () => {
  const allow = columnsFromMigrations(loadMigrationSql(MIGRATIONS), "trips");

  it("allowlist 가 실제 스키마를 반영해요 (local_currency 는 있고 currency 는 없어요)", () => {
    for (const col of [
      "id",
      "user_id",
      "destination",
      "date_range",
      "status",
      "created_at",
      "start_date",
      "end_date",
      "local_currency",
      "auto_settle",
    ]) {
      expect(allow.has(col), col).toBe(true);
    }
    expect(allow.has("currency")).toBe(false);
  });

  it("코드의 모든 trips select 컬럼이 마이그레이션에 있어요", () => {
    const files = listSourceFiles(ROOT, ["app", "lib", "components", "scripts"]);
    const usages = files.flatMap((f) =>
      findSelectUsages(readFileSync(f, "utf8"), "trips", relative(ROOT, f))
    );
    // 가드가 비어 있으면 통과해 버리므로, 핵심 호출이 실제로 잡히는지 확인한다.
    expect(usages.some((u) => u.file.replace(/\\/g, "/") === "lib/agent/run.ts")).toBe(true);

    const unresolved = usages.filter((u) => u.unresolved);
    expect(
      unresolved.map((u) => `${u.file}:${u.line} ${u.unresolved}`),
      "select 인자를 정적으로 풀 수 없어요"
    ).toEqual([]);

    const bad = findUnknownColumns(usages, allow).map(
      (b) => `${b.file.replace(/\\/g, "/")}:${b.line} → trips.${b.column} 컬럼이 마이그레이션에 없어요`
    );
    expect(bad).toEqual([]);
  });

  it("오타 컬럼(currency)이 있으면 어떤 컬럼이 없는지 알려줘요", () => {
    const usages = findSelectUsages(
      `admin.from("trips").select("id, user_id, start_date, end_date, currency")`,
      "trips",
      "lib/agent/run.ts"
    );
    expect(findUnknownColumns(usages, allow)).toEqual([
      { file: "lib/agent/run.ts", line: 1, column: "currency" },
    ]);
  });
});
