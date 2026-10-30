import { describe, expect, it } from "vitest";
import { resolveDocsCountryFromTrip } from "@/lib/checklist/resolve-docs-country";

describe("resolveDocsCountryFromTrip", () => {
  it("일본 destination 키워드로 해석", () => {
    expect(
      resolveDocsCountryFromTrip({ country: "", destination: "오사카" })
    ).toBe("japan");
  });

  it("베트남 destination 키워드로 해석", () => {
    expect(
      resolveDocsCountryFromTrip({ country: "", destination: "다낭" })
    ).toBe("vietnam");
  });

  it("태국 destination 키워드로 해석", () => {
    expect(
      resolveDocsCountryFromTrip({ country: "", destination: "방콕" })
    ).toBe("thailand");
  });

  it("국가 라벨로 해석", () => {
    expect(
      resolveDocsCountryFromTrip({ country: "일본", destination: "모르는도시" })
    ).toBe("japan");
  });
});
