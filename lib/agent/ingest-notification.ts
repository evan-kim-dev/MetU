import "server-only";

import { after } from "next/server";

import {
  createEvent,
  defaultNotificationIdempotencyKey,
  type AgentEventSource,
  type CreateEventResult,
} from "@/lib/agent/ingest";
import { normalizeIngestSource } from "@/lib/agent/ingest-source";
import { buildSmsParsePreview } from "@/lib/agent/sms-text";
import { processEvent } from "@/lib/agent/run";
import {
  pickTripForReceivedAt,
  touchNotificationAt,
  type TripPick,
} from "@/lib/onboarding/agent-context";
import {
  tripPickToResult,
  type TripMatchMissReason,
  type TripMatchRule,
} from "@/lib/onboarding/trip-match";

function todayKst(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export { defaultNotificationIdempotencyKey };

export type NotificationIngestInput = {
  userId: string;
  tokenTripId: string | null;
  app: string;
  title: string;
  body: string;
  receivedAt: string;
  device?: string | null;
  idempotencyKey?: string;
  /** Client-provided; unknown values normalize to sms_shortcut. */
  source?: string | null;
};

export type NotificationIngestOutcome = {
  result: CreateEventResult;
  status: "received" | "unassigned" | "ignored";
  tripId: string | null;
  shouldProcess: boolean;
  source: AgentEventSource;
  /** 날짜 규칙으로 붙인 경우의 규칙 (토큰 지정/테스트면 undefined) */
  matchRule?: TripMatchRule;
  /** unassigned 사유 */
  missReason?: TripMatchMissReason;
};

export async function ingestNotificationPayload(
  input: NotificationIngestInput
): Promise<NotificationIngestOutcome> {
  const receivedAt = input.receivedAt;
  const isDeviceTest = input.body.trimStart().startsWith("MTU-TEST");
  const source = normalizeIngestSource(input.source);

  // Touch + trip pick are independent — parallelize when both needed.
  let tripId: string | null = input.tokenTripId;
  let pick: TripPick | null = null;
  if (!tripId && !isDeviceTest) {
    // 통화 힌트: 같은 날 시작하는 여행이 여럿일 때 local_currency 일치 쪽을 우선한다.
    const hintCurrency =
      buildSmsParsePreview(input.body || input.title, { today: todayKst() })
        ?.currency ?? null;
    const [, picked] = await Promise.all([
      touchNotificationAt(input.userId, input.app, {
        deviceTest: false,
      }),
      pickTripForReceivedAt(input.userId, receivedAt, { hintCurrency }),
    ]);
    pick = picked;
    tripId = picked?.tripId ?? null;
  } else {
    await touchNotificationAt(input.userId, input.app, {
      deviceTest: isDeviceTest,
    });
  }

  const rawKey =
    input.idempotencyKey ??
    defaultNotificationIdempotencyKey({
      userId: input.userId,
      app: input.app,
      title: input.title,
      body: input.body,
      receivedAt,
    });
  const idempotencyKey = `${input.userId}:${rawKey}`;

  if (isDeviceTest) {
    const created = await createEvent({
      userId: input.userId,
      tripId: null,
      source,
      kind: "text",
      payload: {
        app: input.app,
        title: input.title,
        body: input.body,
        received_at: receivedAt,
        receivedAt,
        device: input.device ?? null,
        test: true,
        text: input.body,
      },
      idempotencyKey,
      status: "ignored",
    });
    return {
      result: created,
      status: "ignored",
      tripId: null,
      shouldProcess: false,
      source,
    };
  }

  const payload = {
    app: input.app,
    title: input.title,
    body: input.body,
    received_at: receivedAt,
    receivedAt,
    device: input.device ?? null,
    text: [input.title, input.body].filter(Boolean).join("\n"),
  };

  // Unassigned: store rule-parser preview only (no Gemini / no network).
  // Matched by date rule: store result.match.rule so decide() can refuse auto-save
  // when the match is not exact. Token-bound trips are explicit (no match info).
  let result: Record<string, unknown> | null = null;
  if (!tripId) {
    const preview = buildSmsParsePreview(input.body || input.title, {
      today: todayKst(),
    });
    if (preview) result = { preview };
  }
  if (pick) {
    result = { ...(result ?? {}), ...tripPickToResult(pick) };
  }

  const created = await createEvent({
    userId: input.userId,
    tripId,
    source,
    kind: "text",
    payload,
    idempotencyKey,
    status: tripId ? "received" : "unassigned",
    result,
  });

  return {
    result: created,
    status: tripId ? "received" : "unassigned",
    tripId,
    shouldProcess: Boolean(tripId && created.ok && !created.duplicate),
    source,
    ...(pick ? { matchRule: pick.rule } : {}),
    ...(pick && !tripId && pick.reason ? { missReason: pick.reason } : {}),
  };
}

export function scheduleProcessIfNeeded(
  outcome: NotificationIngestOutcome
): void {
  const result = outcome.result;
  if (outcome.shouldProcess && result.ok && !result.duplicate) {
    const eventId = result.id;
    after(() => processEvent(eventId));
  }
}
