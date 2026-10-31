/**
 * 클라이언트에서 QR 코드를 SVG 문자열로 만든다. (`qrcode` MIT, 동적 import)
 *
 * - 외부 QR 이미지 서비스를 호출하지 않는다. 전부 브라우저 안에서 계산해요.
 * - 번들 크기를 줄이려고 필요할 때만 불러온다(데스크톱 연결 안내 화면).
 * - 호출하는 쪽은 로딩 실패를 반드시 처리해야 한다(주소 텍스트·복사 버튼은 항상 보여 줘요).
 */
export async function renderQrSvg(text: string): Promise<string> {
  const QRCode = await import("qrcode");
  return QRCode.toString(text, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#111111", light: "#ffffff" },
  });
}

/** `<img src>` 로 안전하게 쓰기 위한 data URI (innerHTML 사용 없이 렌더). */
export function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** QR 에 담는 주소. 토큰·세션·개인정보 없이 온보딩 경로만. */
export function handoffUrl(origin: string): string {
  return `${origin}/onboarding/automation`;
}