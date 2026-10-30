import { describe, expect, it } from "vitest";

import {
  TOKEN_LABEL_ANDROID,
  TOKEN_LABEL_IOS,
  defaultTokenLabelForPlatform,
  nextTokenLabel,
} from "@/lib/onboarding/token-label";

describe("nextTokenLabel", () => {
  it("returns base when unused", () => {
    expect(nextTokenLabel([], TOKEN_LABEL_IOS)).toBe(TOKEN_LABEL_IOS);
    expect(nextTokenLabel(["Android 매크로"], TOKEN_LABEL_IOS)).toBe(
      TOKEN_LABEL_IOS
    );
  });

  it("appends 2, 3 when base is taken", () => {
    expect(nextTokenLabel([TOKEN_LABEL_IOS], TOKEN_LABEL_IOS)).toBe(
      "iPhone 단축어 2"
    );
    expect(
      nextTokenLabel(
        [TOKEN_LABEL_IOS, "iPhone 단축어 2"],
        TOKEN_LABEL_IOS
      )
    ).toBe("iPhone 단축어 3");
  });

  it("skips holes filled by higher numbers", () => {
    expect(
      nextTokenLabel(
        [TOKEN_LABEL_ANDROID, "Android 매크로 3"],
        TOKEN_LABEL_ANDROID
      )
    ).toBe("Android 매크로 2");
  });
});

describe("defaultTokenLabelForPlatform", () => {
  it("maps platform to base label", () => {
    expect(defaultTokenLabelForPlatform("ios")).toBe(TOKEN_LABEL_IOS);
    expect(defaultTokenLabelForPlatform("android")).toBe(
      TOKEN_LABEL_ANDROID
    );
  });
});
