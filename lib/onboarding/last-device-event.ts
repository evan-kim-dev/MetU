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

/** 확인 단계 진입(verifyStartedAt) 이후에 도착한 이벤트만. 기준이 없으면 빈 배열. */
export function eventsSince(
  events: AutomationStatusEvent[],
  startedAt: string | undefined
): AutomationStatusEvent[] {
  const base = startedAt ? Date.parse(startedAt) : NaN;
  if (!Number.isFinite(base)) return [];
  return events.filter((e) => {
    const at = Date.parse(e.createdAt);
    return Number.isFinite(at) && at > base;
  });
}

/**
 * 실제 카드 알림(서버 테스트 sim 아님, MTU-TEST 아님) 중 가장 최신 것.
 * 연결 테스트와 섞이지 않게 분리한다.
 */
export function newestRealEvent(
  events: AutomationStatusEvent[]
): AutomationStatusEvent | null {
  let best: AutomationStatusEvent | null = null;
  let bestAt = -Infinity;
  for (const e of events) {
    if (e.source === "sim" || e.isTest) continue;
    const at = Date.parse(e.createdAt);
    if (!Number.isFinite(at)) continue;
    if (at > bestAt) {
      best = e;
      bestAt = at;
    }
  }
  return best;
}
