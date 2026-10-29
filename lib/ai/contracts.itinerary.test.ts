import { describe, expect, it } from "vitest";
import { parseItinerary, parseItineraryPatch } from "@/lib/ai/contracts";

describe("parseItinerary", () => {
  it("parses valid itinerary JSON", () => {
    const json = JSON.stringify({
      summary: "요약",
      days: [
        {
          day: 1,
          theme: "도착",
          items: [
            {
              placeId: "abc",
              slot: "morning",
              durationMin: 90,
              reason: "인기 명소예요",
            },
            {
              placeId: "def",
              slot: "lunch",
              durationMin: 60,
              reason: "점심",
            },
            {
              placeId: "ghi",
              slot: "afternoon",
              durationMin: 75,
              reason: "산책",
            },
          ],
        },
      ],
    });
    const out = parseItinerary(json);
    expect(out?.days).toHaveLength(1);
    expect(out?.days[0]!.items[0]!.placeId).toBe("abc");
  });

  it("returns null for invalid slot", () => {
    const json = JSON.stringify({
      summary: "",
      days: [
        {
          day: 1,
          theme: "x",
          items: [
            { placeId: "a", slot: "brunch", durationMin: 60, reason: "" },
            { placeId: "b", slot: "lunch", durationMin: 60, reason: "" },
            { placeId: "c", slot: "dinner", durationMin: 60, reason: "" },
          ],
        },
      ],
    });
    expect(parseItinerary(json)).toBeNull();
  });
});

describe("parseItineraryPatch", () => {
  it("parses patch ops", () => {
    const json = JSON.stringify({
      ops: [{ op: "replace", day: 2, index: 1, newPlaceId: "x" }],
      explanation: "바꿨어요",
    });
    const out = parseItineraryPatch(json);
    expect(out?.ops[0]?.op).toBe("replace");
    expect(out?.explanation).toBe("바꿨어요");
  });
});
