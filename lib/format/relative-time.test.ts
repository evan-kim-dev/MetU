import { describe, expect, it } from "vitest";

import { formatRelativeTime } from "@/lib/format/relative-time";

describe("formatRelativeTime", () => {
  const now = Date.parse("2026-10-30T12:00:00+09:00");

  it("방금 전", () => {
    expect(formatRelativeTime("2026-10-30T11:59:30+09:00", now)).toBe(
      "방금 전"
    );
  });

  it("1분 전", () => {
    expect(formatRelativeTime("2026-10-30T11:59:00+09:00", now)).toBe(
      "1분 전"
    );
  });

  it("59분 전", () => {
    expect(formatRelativeTime("2026-10-30T11:01:00+09:00", now)).toBe(
      "59분 전"
    );
  });

  it("1시간 전", () => {
    expect(formatRelativeTime("2026-10-30T11:00:00+09:00", now)).toBe(
      "1시간 전"
    );
  });

  it("23시간", () => {
    expect(formatRelativeTime("2026-10-29T13:00:00+09:00", now)).toBe(
      "23시간 전"
    );
  });

  it("1일 전", () => {
    expect(formatRelativeTime("2026-10-29T12:00:00+09:00", now)).toBe(
      "1일 전"
    );
  });

  it("미래 시각", () => {
    expect(formatRelativeTime("2026-10-30T13:00:00+09:00", now)).toBe(
      "방금 전"
    );
  });

  it("잘못된 입력", () => {
    expect(formatRelativeTime("not-a-date", now)).toBe("");
  });
});
