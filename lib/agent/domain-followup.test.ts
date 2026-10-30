import { describe, expect, it, vi } from "vitest";
import {
  pushFollowUpEventId,
  runDomainFollowUps,
  shouldProcessDomainFollowUps,
} from "@/lib/agent/domain-followup";

describe("shouldProcessDomainFollowUps", () => {
  it("skips when parent is already a domain event", () => {
    expect(shouldProcessDomainFollowUps("domain")).toBe(false);
    expect(shouldProcessDomainFollowUps("text")).toBe(true);
    expect(shouldProcessDomainFollowUps("sms")).toBe(true);
  });
});

describe("pushFollowUpEventId", () => {
  it("collects only fresh inserts", () => {
    const ids: string[] = [];
    pushFollowUpEventId(ids, { ok: true, id: "a", duplicate: false });
    pushFollowUpEventId(ids, { ok: true, id: "b", duplicate: true });
    pushFollowUpEventId(ids, { ok: false, error: "x" });
    expect(ids).toEqual(["a"]);
  });
});

describe("runDomainFollowUps", () => {
  it("processes follow-ups for non-domain parents", async () => {
    const process = vi.fn(async () => undefined);
    await runDomainFollowUps("text", ["d1", "d2"], process);
    expect(process).toHaveBeenCalledTimes(2);
    expect(process).toHaveBeenNthCalledWith(1, "d1");
    expect(process).toHaveBeenNthCalledWith(2, "d2");
  });

  it("does not recurse when parent kind is domain", async () => {
    const process = vi.fn(async () => undefined);
    await runDomainFollowUps("domain", ["d1"], process);
    expect(process).not.toHaveBeenCalled();
  });

  it("continues after a single failure", async () => {
    const process = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(undefined);
    await runDomainFollowUps("text", ["bad", "good"], process);
    expect(process).toHaveBeenCalledTimes(2);
  });
});
