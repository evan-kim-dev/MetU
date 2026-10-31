/** Pure helpers for demo-ingest CLI table output (no secrets). */

export type DemoIngestRow = {
  step: number;
  label: string;
  status: string;
  tripId: string | null;
  latencyMs: number;
  eventId?: string | null;
  duplicate?: boolean;
};

export function formatDemoIngestTable(rows: DemoIngestRow[]): string {
  const header = ["step", "label", "status", "tripId", "ms", "eventId"].join(
    "\t"
  );
  const lines = rows.map((r) =>
    [
      String(r.step),
      r.label,
      r.duplicate ? `${r.status}(dup)` : r.status,
      r.tripId ?? "-",
      String(r.latencyMs),
      r.eventId ?? "-",
    ].join("\t")
  );
  return [header, ...lines].join("\n");
}

export function printDemoIngestUsage(): string {
  return [
    "Usage: node scripts/demo-ingest.mjs",
    "Env required:",
    "  DEMO_BASE_URL     e.g. https://example.vercel.app",
    "  METU_INGEST_TOKEN bearer token (never logged)",
  ].join("\n");
}
