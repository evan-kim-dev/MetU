import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { isPublicPagePath, isPublicPath } from "@/lib/auth/route-access";
import { LEDGER_DEEP_LINKS, PAGE_ROUTES } from "./page-routes";

function walkPageFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === "api") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkPageFiles(full, out);
    else if (name === "page.tsx") out.push(full);
  }
  return out;
}

function sampleUrl(pathPattern: string): string {
  return pathPattern.replace(/\[[^\]]+\]/g, "x");
}

describe("Q1 page route inventory", () => {
  it("PAGE_ROUTES 의 파일이 모두 존재하고, 디스크의 page.tsx 와 1:1", () => {
    const root = process.cwd();
    const onDisk = walkPageFiles(join(root, "app"))
      .map((f) => relative(root, f).replace(/\\/g, "/"))
      .sort();
    const listed = PAGE_ROUTES.map((r) => r.file).sort();

    for (const file of listed) {
      expect(existsSync(join(root, file)), `missing ${file}`).toBe(true);
    }

    expect(listed).toEqual(onDisk);
  });

  it("access=public 경로는 isPublicPagePath/isPublicPath 와 일치", () => {
    for (const route of PAGE_ROUTES) {
      const url = sampleUrl(route.path);
      if (route.access === "public") {
        // share-target 은 페이지 prefix 가 아니라 isPublicPath 만
        if (route.path === "/share-target") {
          expect(isPublicPath(url)).toBe(true);
        } else {
          expect(isPublicPagePath(url), route.path).toBe(true);
        }
      } else {
        expect(isPublicPagePath(url), route.path).toBe(false);
      }
    }
  });

  it("여정 딥링크 쿼리 목록이 비어 있지 않아요", () => {
    expect(LEDGER_DEEP_LINKS.length).toBeGreaterThanOrEqual(10);
    expect(LEDGER_DEEP_LINKS).toContain("?step=pay");
    expect(LEDGER_DEEP_LINKS).toContain("?add=receipt");
    expect(LEDGER_DEEP_LINKS).toContain("?settings=");
  });
});
