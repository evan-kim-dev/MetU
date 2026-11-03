/**
 * 레거시/금지 스타일 스캔(D0 래칫).
 * 디렉터리별 위반 수는 `legacy-baseline.json` 이하만 허용.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

export type LegacyHit = {
  file: string;
  pattern: string;
  count: number;
};

const SOURCE_EXT = /\.(tsx?|jsx?|css)$/;

/** 주석·kakao 브랜드 토큰 제거 후 스캔. */
export function stripAllowed(src: string): string {
  return src
    .replace(/kakao-[a-z0-9-]+/gi, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

/**
 * 금지 패턴. 각 항목은 전역 플래그로 matchAll 카운트.
 * VERIFY: D0 런북 기준. kakao-* 는 stripAllowed 로 제외.
 */
export const LEGACY_PATTERNS: ReadonlyArray<{ name: string; re: RegExp }> = [
  { name: "ai-gradient", re: /ai-gradient[\w-]*/g },
  { name: "shadow-glow", re: /shadow-glow/g },
  { name: "text-10px", re: /text-\[10px\]/g },
  { name: "text-2xs", re: /\btext-2xs\b/g },
  { name: "text-3xs", re: /\btext-3xs\b/g },
  {
    name: "tw-palette",
    re: /(?:bg|text|border|ring|fill|stroke|from|to|via)-(?:red|blue|green|gray|slate|zinc|amber|yellow|orange|indigo|purple|pink|emerald|sky|rose|violet|fuchsia|lime|teal|cyan|neutral)-\d{2,3}/g,
  },
  {
    name: "legacy-palette",
    re: /(?:bg|text|border|ring|fill|stroke|from|to|outline|divide|decoration|shadow)-(?:brand|surface|ink|success|mint|danger)(?:-[\w/[\].%]+)?/g,
  },
  {
    name: "legacy-line",
    re: /(?:bg|text|border|ring)-line-(?:soft|muted)/g,
  },
  // 임의 hex / rgb — CSS 변수 정의(# 뒤)는 globals 예외 경로에서 스킵
  { name: "hex", re: /#[0-9a-fA-F]{3,8}\b/g },
  { name: "bracket-hex", re: /\[[^\]]*#[0-9a-fA-F]{3,8}[^\]]*\]/g },
  { name: "rgb", re: /\brgba?\(/g },
];

export function countPatternsInSource(src: string): Map<string, number> {
  const cleaned = stripAllowed(src);
  const out = new Map<string, number>();
  for (const { name, re } of LEGACY_PATTERNS) {
    re.lastIndex = 0;
    const matches = cleaned.match(re);
    if (matches && matches.length > 0) {
      out.set(name, (out.get(name) ?? 0) + matches.length);
    }
  }
  return out;
}

export function walkSourceFiles(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name === "node_modules" || name === ".next" || name === "dist") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkSourceFiles(full, out);
    else if (SOURCE_EXT.test(name)) out.push(full);
  }
  return out;
}

/** 테스트·스토리·스냅샷 제외. */
export function isExcludedFile(absPath: string): boolean {
  const base = absPath.replace(/\\/g, "/");
  if (/\.test\.(tsx?|jsx?)$/.test(base)) return true;
  if (/\.spec\.(tsx?|jsx?)$/.test(base)) return true;
  if (base.includes("/__tests__/")) return true;
  if (base.includes("/__snapshots__/")) return true;
  // 토큰 정의 원본 — hex 가 의도적으로 있음
  if (base.endsWith("/lib/design/tokens.ts")) return true;
  if (base.endsWith("/lib/design/legacy-scan.ts")) return true;
  if (base.endsWith("/app/globals.css")) return true;
  if (base.endsWith("/tailwind.config.ts")) return true;
  if (base.includes("/public/")) return true;
  return false;
}

/**
 * 래칫 키: components/<top> 또는 app/<top> (app 루트 파일은 app/_root).
 */
export function bucketKey(repoRoot: string, absPath: string): string {
  const rel = relative(repoRoot, absPath).replace(/\\/g, "/");
  const parts = rel.split("/");
  if (parts[0] === "components" && parts[1]) {
    return `components/${parts[1]}`;
  }
  if (parts[0] === "app") {
    if (parts.length === 1) return "app/_root";
    // app/trips/... → app/trips ; app/page.tsx → app/_root
    if (parts.length === 2 && SOURCE_EXT.test(parts[1]!)) return "app/_root";
    return `app/${parts[1]}`;
  }
  return parts[0] ?? "other";
}

export type BaselineMap = Record<string, number>;

export function scanLegacyHits(
  repoRoot: string,
  roots: string[] = ["app", "components"]
): { byBucket: BaselineMap; hits: LegacyHit[] } {
  const byBucket: BaselineMap = {};
  const hits: LegacyHit[] = [];

  for (const root of roots) {
    const absRoot = join(repoRoot, root);
    const files = walkSourceFiles(absRoot).filter((f) => !isExcludedFile(f));
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      const counts = countPatternsInSource(src);
      let fileTotal = 0;
      for (const [pattern, n] of counts) {
        fileTotal += n;
        hits.push({
          file: relative(repoRoot, file).split(sep).join("/"),
          pattern,
          count: n,
        });
      }
      if (fileTotal === 0) continue;
      const key = bucketKey(repoRoot, file);
      byBucket[key] = (byBucket[key] ?? 0) + fileTotal;
    }
  }

  return { byBucket, hits };
}

/** 기준선과 비교. 늘어난 버킷만 반환. */
export function findBaselineRegressions(
  baseline: BaselineMap,
  actual: BaselineMap
): Array<{ bucket: string; baseline: number; actual: number }> {
  const keys = new Set([...Object.keys(baseline), ...Object.keys(actual)]);
  const regressions: Array<{
    bucket: string;
    baseline: number;
    actual: number;
  }> = [];
  for (const key of keys) {
    const b = baseline[key] ?? 0;
    const a = actual[key] ?? 0;
    // components/ds 는 항상 0
    const limit = key === "components/ds" ? 0 : b;
    if (a > limit) {
      regressions.push({ bucket: key, baseline: limit, actual: a });
    }
  }
  return regressions.sort((x, y) => x.bucket.localeCompare(y.bucket));
}
