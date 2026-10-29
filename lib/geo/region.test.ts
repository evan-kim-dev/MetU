import { describe, expect, it } from "vitest";
import { regionOf } from "@/lib/geo/region";

describe("regionOf", () => {
  it("서울 destination → KR", () => {
    expect(regionOf({ destination: "서울" })).toBe("KR");
  });

  it("country South Korea → KR", () => {
    expect(regionOf({ country: "South Korea" })).toBe("KR");
  });

  it("오사카 → GLOBAL", () => {
    expect(regionOf({ destination: "오사카" })).toBe("GLOBAL");
  });

  it("제주 근처 좌표 → KR", () => {
    expect(regionOf({ lat: 33.5, lng: 126.5 })).toBe("KR");
  });

  it("도쿄 좌표 → GLOBAL", () => {
    expect(regionOf({ lat: 35.68, lng: 139.7 })).toBe("GLOBAL");
  });

  it("빈 입력 → GLOBAL", () => {
    expect(regionOf({})).toBe("GLOBAL");
  });
});
