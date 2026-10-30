import { describe, expect, it } from "vitest";
import {
  buildSmsParsePreview,
  migrationHintFromError,
  preferSmsParseText,
  stripDuplicatedSmsTitle,
} from "@/lib/agent/sms-text";

const SAMPLE =
  "[신한카드] 승인 15,800원 올리브영 [신한카드] [가림] 10/30 04:08 승인 15,800원 일시불 올리브영 강남점 누적[가림]";

describe("stripDuplicatedSmsTitle", () => {
  it("keeps the fuller second fragment", () => {
    const out = stripDuplicatedSmsTitle(SAMPLE);
    expect(out.startsWith("[신한카드]")).toBe(true);
    expect(out).toContain("올리브영 강남점");
    expect(out.indexOf("승인")).toBe(out.lastIndexOf("승인"));
  });

  it("leaves single-approval text alone", () => {
    const one = "[신한카드] 승인 1,000원 편의점";
    expect(stripDuplicatedSmsTitle(one)).toBe(one);
  });
});

describe("preferSmsParseText", () => {
  it("prefers body over text", () => {
    expect(
      preferSmsParseText({
        text: "title junk",
        body: "[신한카드] 승인 1,000원 편의점",
      })
    ).toBe("[신한카드] 승인 1,000원 편의점");
  });
});

describe("buildSmsParsePreview", () => {
  it("parses sample to olive young gangnam", () => {
    const preview = buildSmsParsePreview(SAMPLE, { today: "2026-10-30" });
    expect(preview).not.toBeNull();
    expect(preview!.amount).toBe(15800);
    expect(preview!.currency).toBe("KRW");
    expect(preview!.merchant).toBe("올리브영 강남점");
    expect(preview!.confidence).toBeGreaterThanOrEqual(0.85);
  });
});

describe("migrationHintFromError", () => {
  it("maps status check and trip_id null", () => {
    expect(
      migrationHintFromError(
        'new row for relation "agent_events" violates check constraint "agent_events_status_check"'
      )
    ).toMatch(/마이그레이션/);
    expect(
      migrationHintFromError('null value in column "trip_id" of relation "agent_events"')
    ).toMatch(/마이그레이션/);
    expect(migrationHintFromError("timeout")).toBeNull();
  });
});
