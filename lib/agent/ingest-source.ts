import { agentEventReasonLine } from "@/lib/agent/event-status";
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

export type IngestStatusDetail = {
  /** unassigned 사유 (lib/onboarding/trip-match.ts). 없으면 일반 문구. */
  reason?: "no_trips" | "no_dates" | "outside_window" | null;
  /** received 일 때 여행을 붙인 규칙. exact 가 아니면 확인이 필요하다고 알린다. */
  rule?: "exact" | "near" | "single" | "none" | null;
};

export function ingestStatusMessage(
  status: "received" | "unassigned" | "ignored",
  duplicate?: boolean,
  detail?: IngestStatusDetail
): string {
  if (duplicate) return "이미 받은 알림이에요 (중복)";
  switch (status) {
    case "received":
      return detail?.rule === "near" || detail?.rule === "single"
        ? "여행에 붙였어요. 날짜가 정확하지 않아 수신함에서 확인해 주세요"
        : "여행에 붙여 처리 중이에요";
    case "unassigned":
      // 수신함·연결 확인과 같은 사유 표(lib/agent/event-status.ts)를 쓴다.
      // "여행이 없어서" 는 no_trips 일 때만 나온다.
      return (
        agentEventReasonLine({ status: "unassigned", reason: detail?.reason }) ??
        "수신함에 보관했어요"
      );
    case "ignored":
      return "연결 테스트로 기록했어요 (지출 아님)";
    default:
      return "받았어요";
  }
}
