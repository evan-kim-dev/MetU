import { describe, expect, it } from "vitest";
import {
  agentEventStatusLabel,
  agentEventStatusLabelForUi,
  formatRelativeKo,
} from "@/lib/agent/event-status";

describe("agentEventStatusLabel", () => {
  it("maps known statuses", () => {
    expect(agentEventStatusLabel("unassigned")).toBe("여행 없음·보관됨");
    expect(agentEventStatusLabel("done")).toBe("가계부 저장됨");
    expect(agentEventStatusLabel("ignored")).toBe("무시됨");
  });

  it("falls back to raw status", () => {
    expect(agentEventStatusLabel("mystery")).toBe("mystery");
  });
});

describe("agentEventStatusLabelForUi", () => {
  it("isTest -> 연결 테스트", () => {
    expect(
      agentEventStatusLabelForUi({ status: "ignored", isTest: true })
    ).toBe("연결 테스트");
  });

  it("non-test uses status map", () => {
    expect(
      agentEventStatusLabelForUi({ status: "ignored", isTest: false })
    ).toBe("무시됨");
  });
});

describe("formatRelativeKo", () => {
  const now = Date.parse("2026-10-30T12:00:00+09:00");

  it("shows minutes and hours", () => {
    expect(
      formatRelativeKo("2026-10-30T11:50:00+09:00", now)
    ).toBe("10분 전");
    expect(
      formatRelativeKo("2026-10-30T09:00:00+09:00", now)
    ).toBe("3시간 전");
  });

  it("shows just now for recent", () => {
    expect(
      formatRelativeKo("2026-10-30T11:59:30+09:00", now)
    ).toBe("방금");
  });
});
