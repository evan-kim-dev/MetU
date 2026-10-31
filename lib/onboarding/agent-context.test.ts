import { beforeEach, describe, expect, it, vi } from "vitest";

const upsert = vi.fn(async (..._args: unknown[]) => ({ error: null }));
vi.mock("@/lib/agent/admin", () => ({
  getAgentAdmin: () => ({
    from: (table: string) => ({
      upsert: (...args: unknown[]) => upsert(table, ...args),
    }),
  }),
}));

import {
  buildNotificationTouchRow,
  touchNotificationAt,
} from "@/lib/onboarding/agent-context";

const NOW = "2026-10-31T00:00:00.000Z";

describe("buildNotificationTouchRow", () => {
  it("실제 알림은 last_notification_at 과 마지막 앱만 갱신해요", () => {
    const row = buildNotificationTouchRow("u1", " 카드앱 ", undefined, NOW);
    expect(row).toEqual({
      user_id: "u1",
      last_notification_at: NOW,
      last_dropped_app: "카드앱",
      updated_at: NOW,
    });
    expect(row).not.toHaveProperty("last_device_test_at");
  });

  it("연결 테스트(device)는 last_device_test_at 만 갱신하고 last_notification_at 을 건드리지 않아요", () => {
    const row = buildNotificationTouchRow(
      "u1",
      "단축어",
      { deviceTest: true },
      NOW
    );
    expect(row).toEqual({
      user_id: "u1",
      last_device_test_at: NOW,
      updated_at: NOW,
    });
    expect(row).not.toHaveProperty("last_notification_at");
    expect(row).not.toHaveProperty("last_dropped_app");
  });
});

describe("touchNotificationAt", () => {
  beforeEach(() => upsert.mockClear());

  it("device 테스트 upsert 에 last_notification_at 이 없어요", async () => {
    await touchNotificationAt("u1", "단축어", { deviceTest: true });
    const [table, row] = upsert.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(table).toBe("agent_user_state");
    expect(row).toHaveProperty("last_device_test_at");
    expect(row).not.toHaveProperty("last_notification_at");
  });

  it("실제 알림 upsert 에는 last_device_test_at 이 없어요", async () => {
    await touchNotificationAt("u1", "카드앱");
    const [, row] = upsert.mock.calls[0] as [string, Record<string, unknown>];
    expect(row).toHaveProperty("last_notification_at");
    expect(row).not.toHaveProperty("last_device_test_at");
  });
});
