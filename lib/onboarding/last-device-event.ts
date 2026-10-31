import type { AutomationStatusEvent } from "@/lib/hooks/useAutomationStatus";

/**
 * 폰에서 실제로 받은 마지막 알림. 서버 테스트(source "sim")는 폰 수신으로 치지 않는다.
 * 기기 테스트(MTU-TEST)는 포함한다(isTest 로 표시). events 는 최신순이라고 가정하지 않고
 * createdAt 으로 고른다.
 */
export function lastDeviceEvent(
  events: AutomationStatusEvent[]
): AutomationStatusEvent | null {
  let best: AutomationStatusEvent | null = null;
  let bestAt = -Infinity;
  for (const e of events) {
    if (e.source === "sim") continue;
    const at = Date.parse(e.createdAt);
    if (!Number.isFinite(at)) continue;
    if (at > bestAt) {
      best = e;
      bestAt = at;
    }
  }
  return best;
}
