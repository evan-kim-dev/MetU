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
  it("투명 처리를 위해 숨긴 video 와 canvas 를 보여 줘요", () => {
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      drawImage: vi.fn(),
      clearRect: vi.fn(),
      getImageData: vi.fn().mockReturnValue({
        data: new Uint8ClampedArray(4),
      }),
      putImageData: vi.fn(),
    });
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);

    render(<LoginWorldHero />);
    const root = screen.getByTestId("login-world-hero");
    const video = root.querySelector("video");
    const canvas = root.querySelector("canvas");
    expect(video?.getAttribute("src")).toBe(
      "/brand/login-traveler-walk.mp4?v=5"
    );
    expect(canvas).toBeTruthy();
  });
});
