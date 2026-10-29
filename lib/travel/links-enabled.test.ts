import { afterEach, describe, expect, it } from "vitest";

import { travelLinksEnabled } from "@/lib/travel/links-enabled";

afterEach(() => {
  delete process.env.NEXT_PUBLIC_TRAVEL_LINKS;
});

describe("travelLinksEnabled", () => {
  it("defaults to enabled", () => {
    delete process.env.NEXT_PUBLIC_TRAVEL_LINKS;
    expect(travelLinksEnabled()).toBe(true);
  });

  it("hides when false / 0 / off", () => {
    process.env.NEXT_PUBLIC_TRAVEL_LINKS = "false";
    expect(travelLinksEnabled()).toBe(false);
    process.env.NEXT_PUBLIC_TRAVEL_LINKS = "0";
    expect(travelLinksEnabled()).toBe(false);
    process.env.NEXT_PUBLIC_TRAVEL_LINKS = "off";
    expect(travelLinksEnabled()).toBe(false);
  });
});
