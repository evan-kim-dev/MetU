import { describe, expect, it } from "vitest";
import {
  bucketKey,
  countPatternsInSource,
  isExcludedFile,
  stripAllowed,
} from "./legacy-scan";

describe("legacy-scan helpers", () => {
  it("stripAllowed 는 주석과 kakao 토큰을 지워요", () => {
    const src = `
      // text-blue-500
      /* bg-red-500 */
      className="kakao-soft text-blue-500"
    `;
    const cleaned = stripAllowed(src);
    expect(cleaned).not.toContain("kakao-soft");
    expect(cleaned).not.toMatch(/bg-red-500/);
    // 주석의 blue 는 사라졌고, className 의 blue 만 남아 1건
    expect(countPatternsInSource(src).get("tw-palette")).toBe(1);
  });

  it("금지 패턴을 세어요", () => {
    const counts = countPatternsInSource(
      `ai-gradient-bg shadow-glow text-[10px] text-2xs bg-brand text-ink-heading border-line-soft #ff00aa rgb(0,0,0)`
    );
    expect(counts.get("ai-gradient")).toBeGreaterThanOrEqual(1);
    expect(counts.get("shadow-glow")).toBe(1);
    expect(counts.get("text-10px")).toBe(1);
    expect(counts.get("legacy-palette")).toBeGreaterThanOrEqual(1);
    expect(counts.get("legacy-line")).toBe(1);
    expect(counts.get("hex")).toBeGreaterThanOrEqual(1);
    expect(counts.get("rgb")).toBe(1);
  });

  it("테스트·토큰 정의 파일은 제외해요", () => {
    expect(isExcludedFile("/x/Foo.test.tsx")).toBe(true);
    expect(isExcludedFile("/x/lib/design/tokens.ts")).toBe(true);
    expect(isExcludedFile("/x/app/globals.css")).toBe(true);
    expect(isExcludedFile("/x/components/ui/Button.tsx")).toBe(false);
  });

  it("버킷 키를 경로에서 만들어요", () => {
    const root = "C:/repo";
    expect(bucketKey(root, "C:/repo/components/ledger/Foo.tsx")).toBe(
      "components/ledger"
    );
    expect(bucketKey(root, "C:/repo/app/trips/[id]/page.tsx")).toBe("app/trips");
    expect(bucketKey(root, "C:/repo/app/page.tsx")).toBe("app/_root");
  });
});
