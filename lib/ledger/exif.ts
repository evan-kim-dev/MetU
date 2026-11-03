/**
 * 원본 사진에서 EXIF 촬영시각·GPS만 뽑아요.
 * 실패·없음은 빈 객체(절대 throw 금지). GPS는 소수점 5자리까지.
 */

export type ReceiptExif = {
  takenAt?: string;
  lat?: number;
  lng?: number;
};

function round5(n: number): number {
  return Math.round(n * 1e5) / 1e5;
}

function toIso(value: unknown): string | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return undefined;
}

/**
 * File/Blob → EXIF. 브라우저·Node 모두. 의존성: exifr (lite).
 */
export async function readReceiptExif(
  file: Blob | ArrayBuffer | Uint8Array
): Promise<ReceiptExif> {
  try {
    const exifr = await import("exifr");
    const parsed = await exifr.parse(file, {
      pick: ["DateTimeOriginal", "CreateDate", "GPSLatitude", "GPSLongitude"],
      translateKeys: false,
      reviveValues: true,
      sanitize: true,
    });
    if (!parsed || typeof parsed !== "object") return {};

    const out: ReceiptExif = {};
    const takenAt = toIso(
      (parsed as { DateTimeOriginal?: unknown }).DateTimeOriginal ??
        (parsed as { CreateDate?: unknown }).CreateDate
    );
    if (takenAt) out.takenAt = takenAt;

    const lat = (parsed as { GPSLatitude?: unknown }).GPSLatitude;
    const lng = (parsed as { GPSLongitude?: unknown }).GPSLongitude;
    if (
      typeof lat === "number" &&
      typeof lng === "number" &&
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    ) {
      out.lat = round5(lat);
      out.lng = round5(lng);
    }
    return out;
  } catch {
    return {};
  }
}

/** FormData에 넣을 때 값이 있을 때만 append. */
export function appendExifFields(
  fd: FormData,
  exif: ReceiptExif
): void {
  if (exif.takenAt) fd.set("exifTakenAt", exif.takenAt);
  if (exif.lat != null) fd.set("exifLat", String(exif.lat));
  if (exif.lng != null) fd.set("exifLng", String(exif.lng));
}
