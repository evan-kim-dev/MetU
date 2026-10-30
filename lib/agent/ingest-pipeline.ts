import "server-only";

import { after } from "next/server";

import {
  createEvent,
  type AgentEventKind,
  type AgentEventSource,
  type AgentEventStatus,
  type CreateEventResult,
} from "@/lib/agent/ingest";
import { processEvent } from "@/lib/agent/run";

export type RunIngestInput = {
  userId: string;
  tripId: string | null;
  source: AgentEventSource;
  kind?: AgentEventKind;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  status?: AgentEventStatus;
  /** When true (default), schedule processEvent if trip is set and insert is fresh. */
  processIfTrip?: boolean;
};

export type RunIngestOutcome = {
  result: CreateEventResult;
  status: AgentEventStatus;
  tripId: string | null;
  scheduled: boolean;
};

/**
 * Shared createEvent + after(processEvent) for session/token ingest routes.
 * Auth + body parsing stay in each route.
 */
export async function runIngest(
  input: RunIngestInput
): Promise<RunIngestOutcome> {
  const status: AgentEventStatus =
    input.status ?? (input.tripId ? "received" : "unassigned");
  const result = await createEvent({
    userId: input.userId,
    tripId: input.tripId,
    source: input.source,
    kind: input.kind ?? "text",
    payload: input.payload,
    idempotencyKey: input.idempotencyKey,
    status,
  });

  const shouldProcess =
    (input.processIfTrip ?? true) &&
    Boolean(input.tripId) &&
    result.ok &&
    !result.duplicate;

  if (shouldProcess && result.ok) {
    const eventId = result.id;
    after(() => processEvent(eventId));
  }

  return {
    result,
    status,
    tripId: input.tripId,
    scheduled: shouldProcess,
  };
}
