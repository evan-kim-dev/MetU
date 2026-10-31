/**
 * 테스트 전용 도우미 — 앱 코드에서 import 하지 않는다 (node:fs 사용).
 *
 * 1) supabase/migrations/*.sql 에서 한 테이블의 컬럼 allowlist 를 뽑는다.
 * 2) 소스 코드의 `.from("<table>").select("…")` 문자열에서 컬럼 이름을 뽑는다.
 *
 * 정규식 기반의 가벼운 정적 검사다. 컬럼명 오타(예: trips.currency, 실제는 local_currency)가
 * 쿼리 오류 → ctx=null → "no-owner-member" 로 번지던 회귀를 막는다.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** SQL 주석 제거 (한 줄 주석과 블록 주석). 문자열 리터럴 안의 "--" 는 마이그레이션에서 쓰지 않는다. */
export function stripSqlComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
}

/** 괄호 깊이 0 에서만 쉼표로 자른다. */
export function splitTopLevel(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of input) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current);
  return parts;
}

const TABLE_CONSTRAINT_STARTERS = new Set([
  "constraint",
  "primary",
  "unique",
  "foreign",
  "check",
  "like",
  "exclude",
]);

function tableNamePattern(table: string): string {
  // public.trips / trips — `trips_foo`, `trip_members` 와 섞이지 않게 뒤를 막는다.
  return `(?:public\\.)?"?${table}"?(?![\\w$])`;
}

/**
 * 마이그레이션 SQL 텍스트들(파일명순)을 순서대로 적용해 table 의 컬럼 집합을 만든다.
 * 지원: create table, alter table … add column / drop column / rename column.
 */
export function columnsFromMigrations(
  sqlTexts: readonly string[],
  table: string
): Set<string> {
  const columns = new Set<string>();
  const name = tableNamePattern(table);
  const createRe = new RegExp(
    `create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?${name}\\s*\\(`,
    "gi"
  );
  const alterRe = new RegExp(
    `alter\\s+table\\s+(?:if\\s+exists\\s+)?(?:only\\s+)?${name}([^;]*);`,
    "gi"
  );

  for (const raw of sqlTexts) {
    const sql = stripSqlComments(raw);

    for (const m of sql.matchAll(createRe)) {
      const start = (m.index ?? 0) + m[0].length;
      let depth = 1;
      let end = start;
      while (end < sql.length && depth > 0) {
        const ch = sql[end];
        if (ch === "(") depth += 1;
        if (ch === ")") depth -= 1;
        end += 1;
      }
      const body = sql.slice(start, end - 1);
      for (const part of splitTopLevel(body)) {
        const first = part.trim().split(/\s+/)[0]?.replace(/"/g, "") ?? "";
        if (!first || TABLE_CONSTRAINT_STARTERS.has(first.toLowerCase())) continue;
        columns.add(first);
      }
    }

    for (const m of sql.matchAll(alterRe)) {
      const actions = m[1] ?? "";
      for (const a of actions.matchAll(
        /add\s+column\s+(?:if\s+not\s+exists\s+)?"?([A-Za-z_][\w$]*)"?/gi
      )) {
        columns.add(a[1]!);
      }
      for (const d of actions.matchAll(
        /drop\s+column\s+(?:if\s+exists\s+)?"?([A-Za-z_][\w$]*)"?/gi
      )) {
        columns.delete(d[1]!);
      }
      for (const r of actions.matchAll(
        /rename\s+column\s+"?([A-Za-z_][\w$]*)"?\s+to\s+"?([A-Za-z_][\w$]*)"?/gi
      )) {
        columns.delete(r[1]!);
        columns.add(r[2]!);
      }
    }
  }
  return columns;
}

export function loadMigrationSql(migrationsDir: string): string[] {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(join(migrationsDir, f), "utf8"));
}

export type SelectUsage = {
  file: string;
  /** 1-based */
  line: number;
  /** select 에 들어간 원문 */
  raw: string;
  /** 검사 대상 컬럼 (별칭, 관계, 별표, 캐스트는 제외) */
  columns: string[];
  /** select 인자를 정적으로 풀지 못했으면 설명 */
  unresolved?: string;
};

/** "alias:col", "col::text" 같은 PostgREST 표기에서 실제 컬럼명만 남긴다. 관계·* 는 null. */
function selectEntryToColumn(entry: string): string | null {
  let e = entry.trim();
  if (!e || e === "*" || e.includes("(")) return null;
  const alias = e.indexOf(":");
  if (alias > 0 && e[alias + 1] !== ":") e = e.slice(alias + 1);
  e = e.split("::")[0]!.trim();
  return /^[A-Za-z_][\w$]*$/.test(e) ? e : null;
}

export function parseSelectColumns(raw: string): string[] {
  return splitTopLevel(raw)
    .map(selectEntryToColumn)
    .filter((c): c is string => c !== null);
}

/**
 * source 안의 `.from("<table>")` 바로 뒤 `.select(...)` 첫 인자를 찾는다.
 * 문자열 리터럴이거나, 같은 파일의 `const NAME = "…"` 로 풀리는 식별자만 지원한다.
 */
export function findSelectUsages(
  source: string,
  table: string,
  file: string
): SelectUsage[] {
  const usages: SelectUsage[] = [];
  const re = new RegExp(
    `\\.from\\(\\s*["']${table}["']\\s*\\)\\s*\\.select\\(\\s*(?:(["'\`])([^"'\`]*)\\1|([A-Za-z_$][\\w$]*))`,
    "g"
  );
  for (const m of source.matchAll(re)) {
    const line = source.slice(0, m.index ?? 0).split("\n").length;
    let raw = m[2];
    if (raw === undefined && m[3]) {
      const ident = m[3];
      const constRe = new RegExp(
        `const\\s+${ident.replace(/\$/g, "\\$")}\\s*(?::\\s*string)?\\s*=\\s*(["'\`])([^"'\`]*)\\1`
      );
      const resolved = source.match(constRe);
      if (resolved) {
        raw = resolved[2];
      } else {
        usages.push({
          file,
          line,
          raw: ident,
          columns: [],
          unresolved: `select(${ident}) 의 값을 같은 파일에서 찾지 못했어요`,
        });
        continue;
      }
    }
    const text = raw ?? "";
    usages.push({ file, line, raw: text, columns: parseSelectColumns(text) });
  }
  return usages;
}

const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "coverage", "dist"]);
const SOURCE_EXT = /\.(ts|tsx|mjs|js)$/;
const TEST_FILE = /\.(test|spec)\.[jt]sx?$/;

export function listSourceFiles(root: string, dirs: readonly string[]): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (SKIP_DIRS.has(entry)) continue;
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else if (SOURCE_EXT.test(entry) && !TEST_FILE.test(entry)) out.push(full);
    }
  };
  for (const d of dirs) {
    try {
      walk(join(root, d));
    } catch {
      // 없는 폴더는 건너뛴다.
    }
  }
  return out;
}

/** allowlist 에 없는 컬럼을 사용처별로 돌려준다. */
export function findUnknownColumns(
  usages: readonly SelectUsage[],
  allowlist: ReadonlySet<string>
): Array<{ file: string; line: number; column: string }> {
  const bad: Array<{ file: string; line: number; column: string }> = [];
  for (const u of usages) {
    for (const column of u.columns) {
      if (!allowlist.has(column)) {
        bad.push({ file: u.file, line: u.line, column });
      }
    }
  }
  return bad;
}
