import { describe, expect, it } from "vitest";
import { mapKakaoDocument } from "@/lib/places/kakao-map";

describe("mapKakaoDocument", () => {
  it("maps FD6 restaurant without inventing rating/hours", () => {
    const place = mapKakaoDocument(
      {
        id: "12345",
        place_name: "명동교자",
        category_name: "음식점 > 한식 > 만두",
        category_group_code: "FD6",
        phone: "02-1234-5678",
        address_name: "서울 중구",
        road_address_name: "서울 중구 명동길 1",
        x: "126.985",
        y: "37.563",
        place_url: "http://place.map.kakao.com/12345",
      },
      "서울"
    );

    expect(place).not.toBeNull();
    expect(place!.kind).toBe("food");
    expect(place!.lat).toBeCloseTo(37.563);
    expect(place!.lng).toBeCloseTo(126.985);
    expect(place!.rating).toBeUndefined();
    expect(place!.openingHours).toBeUndefined();
    expect(place!.userRatingCount).toBeUndefined();
  });

  it("maps AT4 attraction", () => {
    const place = mapKakaoDocument(
      {
        id: "999",
        place_name: "경복궁",
        category_name: "여행 > 관광,명소 > 궁궐",
        category_group_code: "AT4",
        x: "126.977",
        y: "37.579",
      },
      "서울"
    );
    expect(place!.kind).toBe("attraction");
    expect(place!.rating).toBeUndefined();
    expect(place!.openingHours).toBeUndefined();
  });

  it("maps empty category_group_code via category_name shopping hint", () => {
    const place = mapKakaoDocument(
      {
        id: "777",
        place_name: "동대문 쇼핑",
        category_name: "가정,생활 > 쇼핑",
        category_group_code: "",
        x: "127.01",
        y: "37.57",
      },
      "서울"
    );
    expect(place!.kind).toBe("shopping");
    expect(place!.rating).toBeUndefined();
    expect(place!.openingHours).toBeUndefined();
  });
});
