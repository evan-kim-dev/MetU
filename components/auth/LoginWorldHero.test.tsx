// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LoginWorldHero } from "@/components/auth/LoginWorldHero";

vi.mock("next/image", () => ({
  default: (props: {
    src: string;
    alt: string;
    className?: string;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={props.src} alt={props.alt} className={props.className} />
  ),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("LoginWorldHero", () => {
  it("걷기 루프 영상을 보여 줘요", () => {
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(<LoginWorldHero />);
    const root = screen.getByTestId("login-world-hero");
    const video = root.querySelector("video");
    expect(video?.getAttribute("src")).toBe("/brand/login-traveler-walk.mp4");
    expect(video?.hasAttribute("autoplay")).toBe(true);
    expect(video?.hasAttribute("loop")).toBe(true);
    expect((video as HTMLVideoElement).muted).toBe(true);
  });

  it("모션 줄이기면 정지 PNG를 보여 줘요", () => {
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(<LoginWorldHero />);
    const root = screen.getByTestId("login-world-hero");
    expect(root.querySelector("video")).toBeNull();
    const img = root.querySelector("img");
    expect(img?.getAttribute("src")).toBe("/brand/login-traveler.png");
  });
});
