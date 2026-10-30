import "server-only";

import { after } from "next/server";

import {
  createEvent,
  defaultNotificationIdempotencyKey,
  type AgentEventSource,
  type CreateEventResult,
} from "@/lib/agent/ingest";
import { normalizeIngestSource } from "@/lib/agent/ingest-source";
import { processEvent } from "@/lib/agent/run";
import {
  pickTripForReceivedAt,
  touchNotificationAt,
} from "@/lib/onboarding/agent-context";

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
};

export async function ingestNotificationPayload(
  input: NotificationIngestInput
): Promise<NotificationIngestOutcome> {
  const receivedAt = input.receivedAt;
  const isDeviceTest = input.body.trimStart().startsWith("MTU-TEST");
  const source = normalizeIngestSource(input.source);

  // Always touch — including when the event later turns out duplicate.
  await touchNotificationAt(input.userId, input.app, {
    deviceTest: isDeviceTest,
  });

  let tripId: string | null = input.tokenTripId;
  if (!tripId && !isDeviceTest) {
    tripId = await pickTripForReceivedAt(input.userId, receivedAt);
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

  const created = await createEvent({
    userId: input.userId,
    tripId,
    source,
    kind: "text",
    payload: {
      app: input.app,
      title: input.title,
      body: input.body,
      received_at: receivedAt,
      receivedAt,
      device: input.device ?? null,
      text: [input.title, input.body].filter(Boolean).join("\n"),
    },
    idempotencyKey,
    status: tripId ? "received" : "unassigned",
  });

  return {
    result: created,
    status: tripId ? "received" : "unassigned",
    tripId,
    shouldProcess: Boolean(tripId && created.ok && !created.duplicate),
    source,
  };
}

export function scheduleProcessIfNeeded(
  outcome: NotificationIngestOutcome
): void {
  const result = outcome.result;
  if (outcome.shouldProcess && result.ok && !result.duplicate) {
    const eventId = result.id;
    after(() => {
      void processEvent(eventId);
    });
  }
}
