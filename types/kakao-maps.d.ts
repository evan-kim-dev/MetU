/** Minimal Kakao Maps typings used by KakaoTripMap */
declare namespace kakao.maps {
  class LatLng {
    constructor(lat: number, lng: number);
    getLat(): number;
    getLng(): number;
  }
  class LatLngBounds {
    extend(latlng: LatLng): void;
  }
  class Map {
    setBounds(
      bounds: LatLngBounds,
      paddingTop?: number,
      paddingRight?: number,
      paddingBottom?: number,
      paddingLeft?: number
    ): void;
  }
}

interface Window {
  kakao?: {
    maps: typeof kakao.maps & {
      LatLng: typeof kakao.maps.LatLng;
      LatLngBounds: typeof kakao.maps.LatLngBounds;
    };
  };
}
