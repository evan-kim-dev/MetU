// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LoginWorldHero } from "@/components/auth/LoginWorldHero";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("LoginWorldHero", () => {
  it("걷기 루프 MP4를 항상 보여 줘요", () => {
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);

    render(<LoginWorldHero />);
    const root = screen.getByTestId("login-world-hero");
    const video = root.querySelector("video");
    expect(video?.getAttribute("src")).toBe(
      "/brand/login-traveler-walk.mp4?v=3"
    );
    expect(video?.hasAttribute("autoplay")).toBe(true);
    expect(video?.hasAttribute("loop")).toBe(true);
    expect((video as HTMLVideoElement).muted).toBe(true);
    expect(root.querySelector("img")).toBeNull();
  });
});
