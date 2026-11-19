// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/trips",
}));

import { ProfileTopButton } from "@/components/ui/ProfileTopButton";

afterEach(() => cleanup());

describe("ProfileTopButton", () => {
  it("내 정보로 가는 링크예요", () => {
    render(<ProfileTopButton />);
    const link = screen.getByRole("link", { name: "내 정보" });
    expect(link.getAttribute("href")).toBe("/profile");
  });
});
