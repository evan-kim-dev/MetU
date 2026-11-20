// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/trips",
}));

const profileState = {
  profile: {
    name: "여행자",
    email: "",
    avatarUrl: "",
    customAvatarUrl: null as string | null,
    membershipLabel: "회원",
    styles: [] as string[],
  },
  isReady: true,
  updateProfile: vi.fn(),
};

vi.mock("@/lib/profile/ProfileProvider", () => ({
  useProfile: () => profileState,
}));

import { ProfileTopButton } from "@/components/ui/ProfileTopButton";

afterEach(() => {
  cleanup();
  profileState.profile.avatarUrl = "";
  profileState.profile.customAvatarUrl = null;
});

describe("ProfileTopButton", () => {
  it("내 정보로 가는 링크예요", () => {
    render(<ProfileTopButton />);
    const link = screen.getByRole("link", { name: "내 정보" });
    expect(link.getAttribute("href")).toBe("/profile");
    expect(link.querySelector("img")).toBeNull();
  });

  it("프로필 사진이 있으면 아바타로 보여 줘요", () => {
    profileState.profile.avatarUrl = "https://example.com/me.png";
    render(<ProfileTopButton />);
    const img = screen.getByRole("link", { name: "내 정보" }).querySelector(
      "img"
    );
    expect(img?.getAttribute("src")).toBe("https://example.com/me.png");
  });
});
