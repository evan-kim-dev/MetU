import type { AgentEventSource } from "@/lib/agent/ingest";

const ALLOWED: ReadonlySet<string> = new Set([
  "sms_shortcut",
  "sms_android",
  "share",
  "paste",
  "upload",
  "manual",
  "sim",
  "domain",
  "cron",
]);

/** Unknown client sources (e.g. gmail) → sms_shortcut so DB check passes. */
export function normalizeIngestSource(
  raw: string | null | undefined
): AgentEventSource {
  const s = typeof raw === "string" ? raw.trim().slice(0, 40) : "";
  if (s && ALLOWED.has(s)) return s as AgentEventSource;
  return "sms_shortcut";
}

export function ingestStatusMessage(
  status: "received" | "unassigned" | "ignored",
  duplicate?: boolean
): string {
  if (duplicate) return "이미 받은 알림이에요 (중복)";
  switch (status) {
    case "received":
      return "여행에 붙여 처리 중이에요";
    case "unassigned":
      return "여행이 없어서 수신함에 보관했어요";
    case "ignored":
      return "연결 테스트로 기록했어요 (지출 아님)";
    default:
      return "받았어요";
  }
}
