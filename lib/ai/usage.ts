import "server-only";

import { getAgentAdmin } from "@/lib/agent/admin";

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

export function startOfKstDayMs(now = Date.now()): number {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const ymd = fmt.format(now); // YYYY-MM-DD
  return Date.parse(`${ymd}T00:00:00+09:00`);
}

/** In-memory fallback (tests / admin unavailable). */
export const memoryUsageSink: UsageSink = {
  async record(entry) {
    memory.push({ ...entry, at: Date.now() });
  },
  async countToday(userId) {
    const start = startOfKstDayMs();
    return memory.filter((e) => e.userId === userId && e.at >= start).length;
  },
};

/**
 * Persist via service role. On read failure, allow the call (rule 19) and log.
 */
export const dbUsageSink: UsageSink = {
  async record(entry) {
    const admin = getAgentAdmin();
    if (!admin) {
      await memoryUsageSink.record(entry);
      return;
    }
    const { error } = await admin.from("ai_usage_log").insert({
      user_id: entry.userId,
      trip_id: entry.tripId ?? null,
      model: entry.model,
      purpose: entry.purpose,
      input_tokens: entry.inputTokens ?? null,
      output_tokens: entry.outputTokens ?? null,
      ms: entry.ms ?? null,
      ok: entry.ok,
    });
    if (error) {
      console.error("[ai_usage_log] insert", error.message);
      await memoryUsageSink.record(entry);
    }
  },
  async countToday(userId) {
    const admin = getAgentAdmin();
    if (!admin) {
      console.error("[ai_usage_log] countToday: admin unavailable");
      return 0;
    }
    const startIso = new Date(startOfKstDayMs()).toISOString();
    const { count, error } = await admin
      .from("ai_usage_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", startIso);
    if (error) {
      console.error("[ai_usage_log] countToday", error.message);
      return 0;
    }
    return count ?? 0;
  },
};

export function __resetMemoryUsageSinkForTests(): void {
  memory.length = 0;
}

let activeSink: UsageSink = dbUsageSink;

export function getUsageSink(): UsageSink {
  return activeSink;
}

export function setUsageSinkForTests(sink: UsageSink): void {
  activeSink = sink;
}

export function resetUsageSinkForTests(): void {
  activeSink = memoryUsageSink;
}
