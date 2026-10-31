import { describe, expect, it } from "vitest";

import {
  ingestStatusMessage,
  normalizeIngestSource,
} from "@/lib/agent/ingest-source";

describe("normalizeIngestSource", () => {
  it("keeps known sources", () => {
    expect(normalizeIngestSource("sms_shortcut")).toBe("sms_shortcut");
    expect(normalizeIngestSource("sim")).toBe("sim");
  });

  it("maps unknown sources (e.g. gmail) to sms_shortcut without 400", () => {
    expect(normalizeIngestSource("gmail")).toBe("sms_shortcut");
    expect(normalizeIngestSource("")).toBe("sms_shortcut");
    expect(normalizeIngestSource(undefined)).toBe("sms_shortcut");
  });
});

describe("ingestStatusMessage", () => {
  it("explains unassigned and duplicate", () => {
    expect(ingestStatusMessage("unassigned")).toContain("수신함");
    expect(ingestStatusMessage("ignored")).toContain("테스트");
    expect(ingestStatusMessage("received", true)).toContain("중복");
  });
});

describe("ingestStatusMessage — 사유별 문구", () => {
  it("'여행이 없어서' 는 no_trips 일 때만", () => {
    expect(ingestStatusMessage("unassigned", false, { reason: "no_trips" })).toContain(
      "여행이 없어서"
    );
    for (const reason of ["no_dates", "outside_window", null, undefined] as const) {
      expect(ingestStatusMessage("unassigned", false, { reason })).not.toContain(
        "여행이 없어서"
      );
      expect(ingestStatusMessage("unassigned", false, { reason })).toContain("수신함");
    }
  });

  it("near/single 로 붙으면 확인이 필요하다고 알린다", () => {
    expect(ingestStatusMessage("received", false, { rule: "near" })).toContain("확인");
    expect(ingestStatusMessage("received", false, { rule: "single" })).toContain("확인");
    expect(ingestStatusMessage("received", false, { rule: "exact" })).toBe(
      "여행에 붙여 처리 중이에요"
    );
  });
});