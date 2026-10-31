import { describe, expect, it } from "vitest";
import {
  buildDynamicPoiSchedule,
  buildMinimalLodgingTransportSchedule,
  isMinimalScheduleFallback,
} from "@/lib/ai/destination-pois";

describe("buildDynamicPoiSchedule / minimal fallback", () => {
  const budgets = { food: 20_000, activity: 30_000, transport: 10_000 };

  it("builds from attractions", () => {
    const days = buildDynamicPoiSchedule(
      "파리",
      "인천",
      2,
      ["healing"],
      budgets,
      [
        { name: "Eiffel Tower", detail: "에펠탑" },
        { name: "Louvre Museum", detail: "루브르" },
        { name: "Montmartre", detail: "몽마르트" },
      ]
    );
    expect(days).not.toBeNull();
    expect(days!.length).toBe(3);
    expect(days!.some((d) => d.items.some((i) => i.title === "Eiffel Tower"))).toBe(
      true
    );
  });

  it("returns null without attractions", () => {
    expect(
      buildDynamicPoiSchedule("파리", "인천", 2, [], budgets, [])
    ).toBeNull();
  });

  it("minimal schedule is detected for retry tip", () => {
    const days = buildMinimalLodgingTransportSchedule("리스본", "김포", 2, budgets);
    expect(isMinimalScheduleFallback(days)).toBe(true);
    expect(days[0]?.items.some((i) => /숙소|이동|체크인/.test(i.title))).toBe(
      true
    );
  });
});
