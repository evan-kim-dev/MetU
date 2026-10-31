// @vitest-environment jsdom
import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/onboarding/connect/DevCurlFold", () => ({
  DevCurlFold: () => null,
}));

const renderQrSvg = vi.fn(async (_text: string) => "<svg></svg>");
vi.mock("@/lib/onboarding/qr-svg", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/onboarding/qr-svg")>();
  return { ...actual, renderQrSvg: (text: string) => renderQrSvg(text) };
});

const writeText = vi.fn(async () => undefined);
Object.assign(navigator, {
  clipboard: { writeText },
});

import { UnsupportedHandoff } from "@/components/onboarding/connect/UnsupportedHandoff";

beforeEach(() => {
  renderQrSvg.mockImplementation(async () => "<svg></svg>");
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("UnsupportedHandoff", () => {
  it("copies address and has single 나중에 하기", () => {
    const onSkip = vi.fn();
    render(
      <UnsupportedHandoff reason="desktop" skipBusy={false} onSkip={onSkip} />
    );
    expect(screen.getByText("휴대폰에서 이어서 설정해 주세요")).toBeTruthy();
    const laters = screen.getAllByRole("button", { name: /나중에 하기/ });
    expect(laters).toHaveLength(1);
    expect(screen.queryByText(/건너뛰/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "주소 복사" }));
  });

  it("데스크톱: /onboarding/automation 주소만 QR 로 만들고 토큰 같은 건 담지 않아요", async () => {
    render(
      <UnsupportedHandoff reason="desktop" skipBusy={false} onSkip={vi.fn()} />
    );
    const img = await screen.findByRole("img", { name: "휴대폰으로 열기 QR" });
    expect(img.getAttribute("src")).toMatch(/^data:image\/svg\+xml/);
    expect(renderQrSvg).toHaveBeenCalledTimes(1);
    const encoded = renderQrSvg.mock.calls[0]![0];
    expect(encoded).toBe(`${window.location.origin}/onboarding/automation`);
    expect(encoded).not.toMatch(/[?#]|token|metu-/i);
    // QR 이 있어도 주소 텍스트와 복사 버튼은 항상 있어요.
    expect(screen.getByRole("button", { name: "주소 복사" })).toBeTruthy();
    expect(
      screen.getByText(`${window.location.origin}/onboarding/automation`)
    ).toBeTruthy();
  });

  it("안내 문구: 같은 계정 로그인, iPhone Safari, 홈 화면 앱 로그인", () => {
    render(
      <UnsupportedHandoff reason="desktop" skipBusy={false} onSkip={vi.fn()} />
    );
    const text = document.body.textContent ?? "";
    expect(text).toContain("같은 계정으로 로그인해 주세요");
    expect(text).toContain("iPhone은 Safari에서 열고");
    expect(text).toContain("홈 화면 앱은 로그인이 따로");
  });

  it("QR 라이브러리 로딩이 실패해도 주소 복사 버튼이 남아요", async () => {
    renderQrSvg.mockRejectedValueOnce(new Error("chunk load failed"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    render(
      <UnsupportedHandoff reason="desktop" skipBusy={false} onSkip={vi.fn()} />
    );
    await waitFor(() => expect(warn).toHaveBeenCalled());
    expect(screen.queryByRole("img", { name: "휴대폰으로 열기 QR" })).toBeNull();
    expect(screen.getByRole("button", { name: "주소 복사" })).toBeTruthy();
    expect(
      screen.getByText(`${window.location.origin}/onboarding/automation`)
    ).toBeTruthy();
    warn.mockRestore();
  });

  it("그냥 둘러보기 링크는 홈으로 가요", () => {
    render(
      <UnsupportedHandoff reason="desktop" skipBusy={false} onSkip={vi.fn()} />
    );
    expect(
      screen.getByRole("link", { name: "그냥 둘러보기" }).getAttribute("href")
    ).toBe("/");
  });

  it("iOS 27 미만은 QR 을 만들지 않아요", () => {
    render(
      <UnsupportedHandoff reason="ios-low" skipBusy={false} onSkip={vi.fn()} />
    );
    expect(renderQrSvg).not.toHaveBeenCalled();
    expect(screen.queryByRole("img", { name: "휴대폰으로 열기 QR" })).toBeNull();
  });
});
