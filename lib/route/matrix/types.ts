export type TravelMode = "WALK" | "TRANSIT" | "DRIVE";

export interface MatrixPoint {
  id: string;
  lat: number;
  lng: number;
}

export interface TravelMatrix {
  mode: TravelMode;
  durationsSec: number[][];
  distancesM: number[][];
  source: "google-routes" | "kakao" | "osrm" | "haversine";
  region: "KR" | "GLOBAL";
  /** 폴백/추정으로 채운 셀의 [i,j] 목록 (UI 표시용) */
  estimatedCells: Array<[number, number]>;
}
