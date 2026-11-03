import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  findBaselineRegressions,
  scanLegacyHits,
  type BaselineMap,
} from "./legacy-scan";

function loadBaseline(): BaselineMap {
  const raw = JSON.parse(
    readFileSync(join(process.cwd(), "lib/design/legacy-baseline.json"), "utf8")
  ) as Record<string, unknown>;
  const out: BaselineMap = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k.startsWith("_")) continue;
    if (typeof v === "number") out[k] = v;
  }
  return out;
}

describe("legacy style ratchet (D0)", () => {
  it("components/ds 는 항상 0", () => {
    const { byBucket } = scanLegacyHits(process.cwd());
    expect(byBucket["components/ds"] ?? 0).toBe(0);
  });

  it("각 디렉터리 위반 수 ≤ legacy-baseline.json", () => {
    const baseline = loadBaseline();
    const { byBucket } = scanLegacyHits(process.cwd());
    const regressions = findBaselineRegressions(baseline, byBucket);
    expect(
      regressions,
      regressions
        .map((r) => `${r.bucket}: ${r.actual} > ${r.baseline}`)
        .join("\n") || "ok"
    ).toEqual([]);
  });

  it("기준선을 일부러 +1 하면 회귀로 잡힌다", () => {
    const baseline = loadBaseline();
    const { byBucket } = scanLegacyHits(process.cwd());
    const sampleKey =
      Object.keys(byBucket).find((k) => k !== "components/ds") ??
      "components/ui";
    const bumped = {
      ...byBucket,
      [sampleKey]: (byBucket[sampleKey] ?? 0) + 1,
    };
    const regressions = findBaselineRegressions(baseline, bumped);
    expect(regressions.some((r) => r.bucket === sampleKey)).toBe(true);
  });

  it("새 버킷이 기준선에 없고 히트가 있으면 회귀", () => {
    const baseline = loadBaseline();
    const regressions = findBaselineRegressions(baseline, {
      ...scanLegacyHits(process.cwd()).byBucket,
      "components/brand-new-dir": 3,
    });
    expect(
      regressions.some((r) => r.bucket === "components/brand-new-dir")
    ).toBe(true);
  });
});
