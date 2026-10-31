export type ReceiptEventOutcome =
  | "pending"
  | "saved"
  | "merged"
  | "review"
  | "not_receipt"
  | "failed";

type ResultLike = { items?: Array<{ decision?: string }> } | null | undefined;

/**
 * 영수증 업로드 이벤트의 처리 상태를 화면용 결과로 줄인다 (순수 함수).
 * agent_events.status / result 모양은 lib/agent/run.ts 가 만든다.
 */
export function interpretReceiptEvent(
  status: string,
  result: unknown
): ReceiptEventOutcome {
  const items = (result as ResultLike)?.items ?? [];
  switch (status) {
    case "received":
    case "processing":
      return "pending";
    case "done":
      if (items.some((it) => it.decision === "auto_commit")) return "saved";
      if (items.some((it) => it.decision === "merged")) return "merged";
      return "review";
    case "needs_review":
    case "unassigned":
      return "review";
    case "ignored":
      return "not_receipt";
    case "failed":
      return "failed";
    default:
      return "pending";
  }
}
