import { describe, expect, it } from "vitest";
import { getPopularCities } from "@/lib/airports/data";
import { searchPlaces } from "@/lib/airports/search";

describe("searchPlaces", () => {
  it("icn (all) → first is ICN airport", () => {
    const hits = searchPlaces("icn", { mode: "all", limit: 10 });
    expect(hits[0]?.place.code).toBe("ICN");
    expect(hits[0]?.place.kind).toBe("airport");
  });

  it("icn (cities) → first is Seoul with matchedOn code", () => {
    const hits = searchPlaces("icn", { mode: "cities", limit: 10 });
    expect(hits[0]?.place.city).toBe("서울");
    expect(hits[0]?.place.kind).toBe("city");
    expect(hits[0]?.matchedOn).toBe("code");
    expect(hits[0]?.matchedCode).toBe("ICN");
  });

  it("인천 / 김포 (cities) → Seoul", () => {
    expect(searchPlaces("인천", { mode: "cities" })[0]?.place.city).toBe(
      "서울"
    );
    expect(searchPlaces("김포", { mode: "cities" })[0]?.place.city).toBe(
      "서울"
    );
  });

  it("nrt → Tokyo, kix → Osaka", () => {
    expect(searchPlaces("nrt", { mode: "cities" })[0]?.place.city).toBe(
      "도쿄"
    );
    expect(searchPlaces("kix", { mode: "cities" })[0]?.place.city).toBe(
      "오사카"
    );
  });

  it("일본 → country first, then Tokyo/Osaka/Fukuoka", () => {
    const hits = searchPlaces("일본", { mode: "cities", limit: 20 });
    expect(hits[0]?.place.kind).toBe("country");
    expect(hits[0]?.place.country).toBe("일본");
    const cities = hits.filter((h) => h.place.kind === "city").map((h) => h.place.city);
    expect(cities).toEqual(expect.arrayContaining(["도쿄", "오사카", "후쿠오카"]));
  });

  it("japan / jp → Japan country first", () => {
    expect(searchPlaces("japan", { mode: "cities" })[0]?.place.kind).toBe(
      "country"
    );
    expect(searchPlaces("jp", { mode: "cities" })[0]?.place.country).toBe(
      "일본"
    );
  });

  it("후쿠오카 / fukuoka / fuk / 후쿠", () => {
    for (const q of ["후쿠오카", "fukuoka", "fuk", "후쿠"]) {
      const cities = searchPlaces(q, { mode: "cities", limit: 5 });
      expect(cities[0]?.place.city, q).toBe("후쿠오카");

      const all = searchPlaces(q, { mode: "all", limit: 10 });
      expect(all[0]?.place.kind, q).toBe("city");
      expect(all[0]?.place.city, q).toBe("후쿠오카");
      expect(
        all.some((h) => h.place.code === "FUK"),
        q
      ).toBe(true);
    }
  });

  it("일 single char → prefix only (Japan, no Chitose noise)", () => {
    const hits = searchPlaces("일", { mode: "cities", limit: 30 });
    expect(hits.some((h) => h.place.country === "일본" || h.place.kind === "country")).toBe(
      true
    );
    expect(
      hits.some((h) => h.place.name.includes("신치토세") || h.place.code === "CTS")
    ).toBe(false);
  });

  it("trims and ignores case for ICN", () => {
    const hits = searchPlaces("  ICN  ", { mode: "all", limit: 5 });
    expect(hits[0]?.place.code).toBe("ICN");
  });

  it("empty query → same order as getPopularCities", () => {
    const popular = getPopularCities(24);
    const hits = searchPlaces("", { mode: "cities", limit: 24 });
    expect(hits.map((h) => h.place.id)).toEqual(popular.map((p) => p.id));
  });
});
