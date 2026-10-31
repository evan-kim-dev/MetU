import { describe, expect, it } from "vitest";

import {
  formatDemoIngestTable,
  printDemoIngestUsage,
} from "./ingest-table";

describe("demo ingest table", () => {
  it("formats rows without secrets", () => {
    const table = formatDemoIngestTable([
      {
        step: 1,
        label: "호텔",
        status: "received",
        tripId: "trip-1",
        latencyMs: 120,
        eventId: "evt-1",
      },
    ]);
    expect(table).toContain("step\tlabel");
    expect(table).toContain("1\t호텔\treceived\ttrip-1\t120\tevt-1");
    expect(table.toLowerCase()).not.toContain("metu-");
    expect(table.toLowerCase()).not.toContain("token");
  });

  it("usage mentions env vars only", () => {
    const usage = printDemoIngestUsage();
    expect(usage).toContain("DEMO_BASE_URL");
    expect(usage).toContain("METU_INGEST_TOKEN");
  });
});
