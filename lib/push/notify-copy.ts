import type { PushPayload } from "@/lib/push/send";

function fmtWon(n: unknown): string {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return "";
  return `${Math.round(v).toLocaleString("ko-KR")}원`;
}

/** Map agent notification type → web push copy (Korean). */
export function pushPayloadForNotification(args: {
  type: string;
  tripId: string;
  payload?: Record<string, unknown>;
  notificationId?: string;
}): PushPayload {
  const { type, tripId, payload = {}, notificationId } = args;
  const ledger = `/trips/${tripId}/ledger`;
  const inbox = `${ledger}/inbox`;
  const settle = `${ledger}/settle`;
  const tag =
    (typeof payload.dedupe_key === "string" && payload.dedupe_key) ||
    notificationId ||
    `${type}:${tripId}`;

  switch (type) {
    case "expense_added": {
      const merchant =
        typeof payload.merchant === "string" ? payload.merchant.trim() : "";
      const krw = fmtWon(payload.krwAmount);
      const body =
        merchant && krw
          ? `${merchant} · ${krw}`
          : krw || merchant || "가계부에 반영됐어요.";
      return {
        title: "지출이 저장됐어요",
        body,
        url: ledger,
        tag,
      };
    }
    case "expense_review":
      return {
        title: "확인이 필요한 지출",
        body: "에이전트가 검토가 필요한 항목을 보냈어요.",
        url: inbox,
        tag,
      };
    case "settlement_ready":
      return {
        title: "정산이 준비됐어요",
        body: "송금 안내를 확인해 주세요.",
        url: settle,
        tag,
      };
    case "settlement_stale":
      return {
        title: "정산이 갱신됐어요",
        body: "지출 변경으로 정산안이 바뀌었어요.",
        url: settle,
        tag,
      };
    default:
      return {
        title: "Met-U 알림",
        body: "",
        url: ledger,
        tag,
      };
  }
}
