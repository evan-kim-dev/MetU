import type { CreateEventResult } from "@/lib/agent/ingest";

/** Domain handlers must not enqueue nested domain follow-ups (recursion guard). */
export function shouldProcessDomainFollowUps(parentKind: string): boolean {
  return parentKind !== "domain";
}

/** Collect newly inserted domain event ids; skip duplicates/failures. */
export function pushFollowUpEventId(
  ids: string[],
  result: CreateEventResult
): void {
  if (result.ok && !result.duplicate) {
    ids.push(result.id);
  }
}

/**
 * Sequentially process follow-up domain events after the parent event finishes.
 * Errors are isolated so one failure does not block the rest.
 */
export async function runDomainFollowUps(
  parentKind: string,
  ids: readonly string[],
  process: (id: string) => Promise<void>
): Promise<void> {
  if (!shouldProcessDomainFollowUps(parentKind) || ids.length === 0) {
    return;
  }
  for (const id of ids) {
    try {
      await process(id);
    } catch (err) {
      console.error(
        "[domain-followup]",
        id,
        err instanceof Error ? err.message : err
      );
    }
  }
}
