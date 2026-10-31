// @vitest-environment jsdom
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/onboarding/guide/ShortcutGuide", () => ({
  ShortcutGuide: () => <div>shortcut-guide</div>,
}));
vi.mock("@/components/onboarding/connect/AppPicker", () => ({
  AppPicker: () => <div>app-picker</div>,
}));

import { StepAutomation } from "@/components/onboarding/connect/StepAutomation";
import {
  SHORTCUTS_OPEN_HINT_MS,
  ShortcutsAppActions,
} from "@/components/onboarding/connect/ShortcutsAppActions";
import type { DetectedPlatform } from "@/lib/onboarding/automation";
import {
  buildRunShortcutUrl,
  IOS_SHORTCUT_NAME,
  IOS_SHORTCUTS_APP_URL,
} from "@/lib/onboarding/constants";
import {
  ANDROID_PWA_FLOW_SECTION,
  IOS_SMS_AUTOMATION_SECTION,
} from "@/lib/onboarding/guide-content";

const FORBIDDEN_SETTINGS_COPY = /설정 앱 열기|설정 앱을 열|설정을 열어/;

function renderStep(platform: DetectedPlatform) {
  return render(
    <StepAutomation
      platform={platform}
      token="metu-TEST-TEST-TEST-TEST"
      selectedApps={[]}
      onSelectedApps={vi.fn()}
      onConfirm={vi.fn()}
    />
  );
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("StepAutomation shortcuts:// actions", () => {
  it("shows shortcuts:// buttons only on iOS", () => {
    renderStep("ios");
    const open = screen.getByRole("link", { name: "단축어 앱 열기" });
    expect(open.getAttribute("href")).toBe(IOS_SHORTCUTS_APP_URL);
    expect(
      screen.getByRole("link", { name: "단축어 실행해서 테스트" })
    ).toBeTruthy();
    expect(screen.getByText("처음엔 iOS 확인 팝업이 떠요")).toBeTruthy();
  });

  it.each(["android", "desktop", "other"] as const)(
    "hides shortcuts:// buttons on %s",
    (platform) => {
      renderStep(platform);
      expect(screen.queryByRole("link", { name: "단축어 앱 열기" })).toBeNull();
      expect(
        screen.queryByRole("link", { name: "단축어 실행해서 테스트" })
      ).toBeNull();
      expect(document.querySelector('a[href^="shortcuts:"]')).toBeNull();
    }
  );

  it("url-encodes the shortcut name from constants", () => {
    renderStep("ios");
    const run = screen.getByRole("link", { name: "단축어 실행해서 테스트" });
    const href = run.getAttribute("href") ?? "";
    expect(href).toBe(buildRunShortcutUrl());
    expect(href).toBe(
      `shortcuts://run-shortcut?name=${encodeURIComponent(IOS_SHORTCUT_NAME)}`
    );
    expect(href).not.toContain(" ");
    expect(href).not.toContain(IOS_SHORTCUT_NAME);
    expect(new URL(href).searchParams.get("name")).toBe(IOS_SHORTCUT_NAME);
  });

  it("encodes special characters in custom names", () => {
    expect(buildRunShortcutUrl("a b&c=d")).toBe(
      "shortcuts://run-shortcut?name=a%20b%26c%3Dd"
    );
  });

  it("never navigates by itself (no timer/mount navigation)", () => {
    const before = window.location.href;
    renderStep("ios");
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(window.location.href).toBe(before);
  });

  it("only user tap triggers the open link; native navigation is not prevented", () => {
    renderStep("ios");
    const open = screen.getByRole("link", { name: "단축어 앱 열기" });
    // fireEvent returns false when preventDefault was called.
    const notPrevented = fireEvent.click(open);
    expect(notPrevented).toBe(true);
  });

  it("shows fallback hint 1.5s after tap when page stays visible", () => {
    render(<ShortcutsAppActions platform="ios" />);
    const open = screen.getByRole("link", { name: "단축어 앱 열기" });
    expect(screen.queryByText(/직접 열어 주세요/)).toBeNull();
    fireEvent.click(open);
    act(() => {
      vi.advanceTimersByTime(SHORTCUTS_OPEN_HINT_MS - 1);
    });
    expect(screen.queryByText(/직접 열어 주세요/)).toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(
      screen.getByText("단축어 앱이 열리지 않으면 홈 화면에서 직접 열어 주세요")
    ).toBeTruthy();
  });

  it("skips fallback hint when page becomes hidden after tap", () => {
    render(<ShortcutsAppActions platform="ios" />);
    fireEvent.click(screen.getByRole("link", { name: "단축어 앱 열기" }));
    const spy = vi
      .spyOn(document, "visibilityState", "get")
      .mockReturnValue("hidden");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      vi.advanceTimersByTime(SHORTCUTS_OPEN_HINT_MS + 100);
    });
    spy.mockRestore();
    expect(screen.queryByText(/직접 열어 주세요/)).toBeNull();
  });

  it("warns that the shortcut name may differ", () => {
    renderStep("ios");
    expect(screen.getByText(/이름이 다르면 열리지 않을 수 있어요/)).toBeTruthy();
  });
});

describe("StepAutomation copy", () => {
  it.each(["ios", "android", "desktop"] as const)(
    "has no 'open Settings app' promise on %s",
    (platform) => {
      renderStep(platform);
      fireEvent.click(
        screen.queryByRole("link", { name: "단축어 앱 열기" }) ??
          document.body
      );
      expect(document.body.textContent ?? "").not.toMatch(
        FORBIDDEN_SETTINGS_COPY
      );
    }
  );

  it("guide side sections have no 'open Settings app' promise", () => {
    for (const s of [IOS_SMS_AUTOMATION_SECTION, ANDROID_PWA_FLOW_SECTION]) {
      const all = [s.title, s.intro ?? "", ...s.items, s.note ?? ""].join("\n");
      expect(all).not.toMatch(FORBIDDEN_SETTINGS_COPY);
    }
  });

  it("shows SMS automation section on iOS only", () => {
    const { unmount } = renderStep("ios");
    expect(screen.getByText(IOS_SMS_AUTOMATION_SECTION.title)).toBeTruthy();
    unmount();
    renderStep("android");
    expect(screen.queryByText(IOS_SMS_AUTOMATION_SECTION.title)).toBeNull();
  });

  it("shows Android PWA card and MacroDroid Play link on Android only", () => {
    const { unmount } = renderStep("ios");
    expect(screen.queryByText(ANDROID_PWA_FLOW_SECTION.title)).toBeNull();
    expect(screen.queryByText(/MacroDroid 받기/)).toBeNull();
    unmount();
    renderStep("android");
    expect(screen.getByText(ANDROID_PWA_FLOW_SECTION.title)).toBeTruthy();
    const play = screen.getByRole("link", {
      name: "Play 스토어에서 MacroDroid 받기",
    });
    expect(play.getAttribute("href")).toContain("play.google.com");
  });
});
