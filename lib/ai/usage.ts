import "server-only";

export type UsageRecord = {
  userId: string;
  tripId?: string | null;
  model: string;
  purpose: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
  ms?: number | null;
  ok: boolean;
};

export type UsageSink = {
  record(entry: UsageRecord): Promise<void>;
  countToday(userId: string): Promise<number>;
};

type MemoryEntry = UsageRecord & { at: number };

const memory: MemoryEntry[] = [];

function startOfKstDayMs(now = Date.now()): number {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const ymd = fmt.format(now); // YYYY-MM-DD
  // Approximate: treat KST midnight as UTC+9
  return Date.parse(`${ymd}T00:00:00+09:00`);
}

/** In-memory sink. TODO(P14): swap to ai_usage_log via lib/agent/admin.ts */
export const memoryUsageSink: UsageSink = {
  async record(entry) {
    memory.push({ ...entry, at: Date.now() });
  },
  async countToday(userId) {
    const start = startOfKstDayMs();
    return memory.filter((e) => e.userId === userId && e.at >= start).length;
  },
};

export function __resetMemoryUsageSinkForTests(): void {
  memory.length = 0;
}

let activeSink: UsageSink = memoryUsageSink;

export function getUsageSink(): UsageSink {
  return activeSink;
}

export function setUsageSinkForTests(sink: UsageSink): void {
  activeSink = sink;
}

export function resetUsageSinkForTests(): void {
  activeSink = memoryUsageSink;
}
