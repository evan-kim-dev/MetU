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
