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
});

describe("LoginWorldHero", () => {
  it("여행자 일러스트와 걷기 모션 클래스를 보여 줘요", () => {
    render(<LoginWorldHero />);
    const root = screen.getByTestId("login-world-hero");
    expect(root.className).toContain("login-traveler-walk");
    const img = root.querySelector("img");
    expect(img?.getAttribute("src")).toBe("/brand/login-traveler.png");
  });
});
