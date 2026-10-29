import { describe, expect, it } from "vitest";
import { mapGooglePlace } from "@/lib/places/google-map";

describe("mapGooglePlace", () => {
  it("maps operational place with opening hours", () => {
    const place = mapGooglePlace(
      {
        id: "places/ChIJabc",
        displayName: { text: "Osaka Castle" },
        formattedAddress: "Osaka, Japan",
        location: { latitude: 34.6873, longitude: 135.5262 },
        types: ["tourist_attraction", "point_of_interest"],
        primaryType: "tourist_attraction",
        rating: 4.5,
        userRatingCount: 12000,
        priceLevel: "PRICE_LEVEL_FREE",
        regularOpeningHours: {
          periods: [
            {
              open: { day: 1, hour: 9, minute: 0 },
              close: { day: 1, hour: 17, minute: 0 },
            },
          ],
        },
        utcOffsetMinutes: 540,
        googleMapsUri: "https://maps.google.com/?cid=1",
        businessStatus: "OPERATIONAL",
      },
      "오사카"
    );

    expect(place).not.toBeNull();
    expect(place!.providerPlaceId).toBe("ChIJabc");
    expect(place!.kind).toBe("attraction");
    expect(place!.rating).toBe(4.5);
    expect(place!.openingHours).toEqual([
      { day: 1, open: "09:00", close: "17:00" },
    ]);
  });

  it("excludes non-operational business", () => {
    const place = mapGooglePlace(
      {
        id: "places/closed1",
        displayName: { text: "Closed Cafe" },
        location: { latitude: 34.7, longitude: 135.5 },
        businessStatus: "CLOSED_PERMANENTLY",
        types: ["cafe"],
      },
      "오사카"
    );
    expect(place).toBeNull();
  });

  it("maps place without opening hours", () => {
    const place = mapGooglePlace(
      {
        id: "places/nohours",
        displayName: { text: "Local Spot" },
        location: { latitude: 34.7, longitude: 135.5 },
        types: ["restaurant"],
        primaryType: "restaurant",
        rating: 4.1,
        userRatingCount: 200,
        businessStatus: "OPERATIONAL",
      },
      "오사카"
    );
    expect(place).not.toBeNull();
    expect(place!.kind).toBe("food");
    expect(place!.openingHours).toBeUndefined();
  });
});
