/**
 * 영수증 이미지 크기 한도 — 클라이언트 resize 와 서버 업로드 검사가 같은 값을 쓴다.
 * 이 파일이 유일한 정의 위치다 (상수 중복 금지).
 */
export const DEFAULT_RECEIPT_MAX_IMAGE_MB = 4;

/** multipart 오버헤드(경계·필드) 허용치 */
export const MULTIPART_OVERHEAD_BYTES = 256_000;

export function receiptMaxImageBytes(
  env: Record<string, string | undefined> = typeof process !== "undefined"
    ? process.env
    : {}
): number {
  const parsed = Number(env.RECEIPT_MAX_IMAGE_MB ?? DEFAULT_RECEIPT_MAX_IMAGE_MB);
  const mb =
    Number.isFinite(parsed) && parsed > 0
      ? parsed
      : DEFAULT_RECEIPT_MAX_IMAGE_MB;
  return mb * 1024 * 1024;
}
