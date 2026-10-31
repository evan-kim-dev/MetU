import { describe, expect, it } from "vitest";

import {
  handoffUrl,
  renderQrSvg,
  svgToDataUri,
} from "@/lib/onboarding/qr-svg";

describe("qr-svg", () => {
  it("handoffUrl 은 온보딩 경로만 담아요(토큰·쿼리 없음)", () => {
    expect(handoffUrl("https://met-u.vercel.app")).toBe(
      "https://met-u.vercel.app/onboarding/automation"
    );
  });

  it("renderQrSvg 는 외부 호출 없이 SVG 문자열을 만들어요", async () => {
    const svg = await renderQrSvg("https://met-u.vercel.app/onboarding/automation");
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).not.toMatch(/https?:\/\/(?!www\.w3\.org)/);
  });

  it("svgToDataUri 는 img src 로 쓸 수 있는 data URI 예요", () => {
    expect(svgToDataUri("<svg></svg>")).toBe(
      "data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C%2Fsvg%3E"
    );
  });
});