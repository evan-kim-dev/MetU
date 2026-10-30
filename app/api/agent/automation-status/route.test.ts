import { beforeEach, describe, expect, it, vi } from "vitest";

const guardApi = vi.fn();
const getAgentAdmin = vi.fn();
const loadAgentUserState = vi.fn(
  async (_userId: string): Promise<unknown> => null
);
const userHasActiveIngestToken = vi.fn(async (_userId: string) => true);
const userHasActiveTrip = vi.fn(async (_userId: string) => false);
const parseSelectedApps = vi.fn((_raw: unknown): string[] => []);

vi.mock("@/lib/security/guard", () => ({
  guardApi: (...args: unknown[]) => guardApi(...args),
}));
vi.mock("@/lib/agent/admin", () => ({
  getAgentAdmin: () => getAgentAdmin(),
}));
vi.mock("@/lib/onboarding/agent-context", () => ({
  loadAgentUserState: (userId: string) => loadAgentUserState(userId),
  userHasActiveIngestToken: (userId: string) =>
    userHasActiveIngestToken(userId),
  userHasActiveTrip: (userId: string) => userHasActiveTrip(userId),
  parseSelectedApps: (raw: unknown) => parseSelectedApps(raw),
}));

describe("GET /api/agent/automation-status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    guardApi.mockResolvedValue({
      identity: { kind: "user", userId: "user-1" },
    });
    loadAgentUserState.mockResolvedValue({
      onboarding_status: "partial",
      platform: "ios",
      selected_apps: [],
      last_notification_at: null,
      last_device_test_at: null,
      last_server_test_at: null,
      last_dropped_app: null,
    });
    userHasActiveIngestToken.mockResolvedValue(true);
    userHasActiveTrip.mockResolvedValue(false);
  });

  it("marks isTest and excludes sim from hasRecentEvent", async () => {
    const limit = vi.fn(async () => ({
      data: [
        {
          id: "1",
          status: "ignored",
          created_at: "t1",
          source: "sim",
          trip_id: null,
          error: null,
          payload: { body: "MTU-TEST hello" },
          result: { test: true },
        },
        {
          id: "2",
          status: "done",
          created_at: "t2",
          source: "notification",
          trip_id: null,
          error: null,
          payload: { body: "승인 1000원" },
          result: {},
        },
      ],
    }));
    const order = vi.fn(() => ({ limit }));
    const eqEvents = vi.fn(() => ({ order }));
    const selectEvents = vi.fn(() => ({ eq: eqEvents }));

    const countSelect = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(async () => ({ count: 0 })),
      })),
    }));

    const from = vi.fn((table: string) => {
      if (table === "agent_events") {
        return {
          select: (cols: string, opts?: { head?: boolean }) => {
            if (opts?.head) return countSelect();
            return selectEvents();
          },
        };
      }
      return { select: selectEvents };
    });

    getAgentAdmin.mockReturnValue({ from });

    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/agent/automation-status")
    );
    const json = (await res.json()) as {
      hasRecentEvent: boolean;
      recentEvents: Array<{ isTest: boolean; source: string }>;
    };
    expect(json.recentEvents[0]?.isTest).toBe(true);
    expect(json.recentEvents[1]?.isTest).toBe(false);
    expect(json.hasRecentEvent).toBe(true);
  });

  it("lite=1 skips event list query", async () => {
    const limit = vi.fn();
    const order = vi.fn(() => ({ limit }));
    const eq = vi.fn(() => ({ order }));
    const selectList = vi.fn(() => ({ eq }));

    const neq = vi.fn(() => ({
      limit: vi.fn(async () => ({ count: 1 })),
    }));
    const eqLite = vi.fn(() => ({ neq }));
    const selectLite = vi.fn(() => ({ eq: eqLite }));

    const from = vi.fn(() => ({
      select: (
        _cols: string,
        opts?: { count?: string; head?: boolean }
      ) => {
        if (opts?.head) return selectLite();
        return selectList();
      },
    }));
    getAgentAdmin.mockReturnValue({ from });

    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/agent/automation-status?lite=1")
    );
    const json = (await res.json()) as {
      recentEvents: unknown[];
      unassignedCount: number;
      hasRecentEvent: boolean;
    };
    expect(json.recentEvents).toEqual([]);
    expect(json.unassignedCount).toBe(0);
    expect(json.hasRecentEvent).toBe(true);
    expect(selectList).not.toHaveBeenCalled();
  });
});
