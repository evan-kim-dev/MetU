import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const sendPush = vi.fn();

vi.mock("@/lib/agent/admin", () => ({
  getAgentAdmin: () => ({ rpc }),
}));

vi.mock("@/lib/push/send", () => ({
  sendPush: (...args: unknown[]) => sendPush(...args),
}));

vi.mock("@/lib/push/notify-copy", () => ({
  pushPayloadForNotification: () => ({ title: "t", body: "b" }),
}));

describe("notifyUsers", () => {
  beforeEach(() => {
    rpc.mockReset();
    sendPush.mockReset();
  });

  it("awaits push and still resolves when sendPush rejects", async () => {
    rpc.mockResolvedValue({ data: "n1", error: null });
    sendPush.mockRejectedValue(new Error("push-down"));

    const { notifyUsers } = await import("@/lib/agent/notify");
    await expect(
      notifyUsers({
        userIds: ["u1"],
        type: "expense_added",
        tripId: "t1",
        dedupeKey: "k1",
      })
    ).resolves.toBeUndefined();

    expect(sendPush).toHaveBeenCalledTimes(1);
  });

  it("skips push when agent_notify returns no id", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    const { notifyUsers } = await import("@/lib/agent/notify");
    await notifyUsers({
      userIds: ["u1"],
      type: "expense_added",
      tripId: "t1",
    });
    expect(sendPush).not.toHaveBeenCalled();
  });
});
