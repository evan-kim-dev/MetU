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

type Row = Record<string, unknown>;

/**
 * agent_events 쿼리 체인 mock.
 * - 목록/실제 이벤트 조회: select → eq → (neq) → order → limit → rows
 * - 미배정 count: select(head) → eq → eq → { count }
 * 호출된 필터를 기록해 sim 제외 여부를 검증한다.
 */
function makeAdmin(opts: {
  /** 사용자의 모든 이벤트(최신순). neq("source","sim") 가 걸리면 sim 제외. */
  events: Row[];
  unassignedCount?: number;
}) {
  const calls: Array<{ neqSource: string | null; limit: number | null }> = [];
  const from = vi.fn((table: string) => {
    if (table !== "agent_events") throw new Error(`unexpected table ${table}`);
    return {
      select: (_cols: string, o?: { head?: boolean }) => {
        if (o?.head) {
          return {
            eq: () => ({
              eq: async () => ({ count: opts.unassignedCount ?? 0 }),
            }),
          };
        }
        const state = { neqSource: null as string | null };
        const chain = {
          eq: () => chain,
          neq: (col: string, v: string) => {
            if (col === "source") state.neqSource = v;
            return chain;
          },
          order: () => chain,
          limit: async (n: number) => {
            calls.push({ neqSource: state.neqSource, limit: n });
            const rows = opts.events.filter(
              (e) => state.neqSource == null || e.source !== state.neqSource
            );
            return { data: rows.slice(0, n) };
          },
        };
        return chain;
      },
    };
  });
  return { admin: { from }, calls };
}

const SIM_TEST = {
  id: "1",
  status: "done",
  created_at: "2026-10-31T00:05:00.000Z",
  source: "sim",
  trip_id: null,
  error: null,
  payload: { body: "MTU-TEST-SERVER" },
  result: { test: true },
};
const DEVICE_TEST = {
  id: "2",
  status: "ignored",
  created_at: "2026-10-31T00:04:00.000Z",
  source: "sms_shortcut",
  trip_id: null,
  error: null,
  payload: { body: "MTU-TEST 연결 확인", test: true },
  result: null,
};
const REAL = {
  id: "3",
  status: "done",
  created_at: "2026-10-31T00:03:00.000Z",
  source: "notification",
  trip_id: null,
  error: null,
  payload: { body: "승인 1000원" },
  result: {},
};

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
      last_device_test_at: "2026-10-31T00:04:00.000Z",
      last_server_test_at: null,
      last_dropped_app: null,
    });
    userHasActiveIngestToken.mockResolvedValue(true);
    userHasActiveTrip.mockResolvedValue(false);
  });

  it("marks isTest and excludes sim from hasRecentEvent", async () => {
    const { admin } = makeAdmin({ events: [SIM_TEST, DEVICE_TEST, REAL] });
    getAgentAdmin.mockReturnValue(admin);

    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/agent/automation-status")
    );
    const json = (await res.json()) as {
      hasRecentEvent: boolean;
      recentEvents: Array<{ id: string; isTest: boolean; source: string }>;
    };
    expect(json.recentEvents[0]?.isTest).toBe(true);
    expect(json.recentEvents[1]?.isTest).toBe(true);
    expect(json.recentEvents[2]?.isTest).toBe(false);
    expect(json.hasRecentEvent).toBe(true);
  });

  it("lastRealEventAt 은 sim 과 연결 테스트(MTU-TEST)를 제외한 최신 이벤트예요", async () => {
    const { admin, calls } = makeAdmin({
      events: [SIM_TEST, DEVICE_TEST, REAL],
    });
    getAgentAdmin.mockReturnValue(admin);

    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/agent/automation-status")
    );
    const json = (await res.json()) as {
      lastRealEventAt: string | null;
      lastDeviceTestAt: string | null;
      lastNotificationAt: string | null;
      serverNow: string;
    };
    expect(json.lastRealEventAt).toBe(REAL.created_at);
    // 연결 테스트는 따로 내려오고, 실제 알림 시각을 오염시키지 않아요.
    expect(json.lastDeviceTestAt).toBe("2026-10-31T00:04:00.000Z");
    expect(json.lastNotificationAt).toBeNull();
    expect(Number.isFinite(Date.parse(json.serverNow))).toBe(true);
    // 실제 이벤트 조회에는 source<>sim 필터가 걸려요.
    expect(calls.some((c) => c.neqSource === "sim")).toBe(true);
  });

  it("테스트/서버 테스트만 있으면 lastRealEventAt 은 null 이에요", async () => {
    const { admin } = makeAdmin({ events: [SIM_TEST, DEVICE_TEST] });
    getAgentAdmin.mockReturnValue(admin);

    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/agent/automation-status?lite=1")
    );
    const json = (await res.json()) as {
      lastRealEventAt: string | null;
      hasRecentEvent: boolean;
    };
    expect(json.lastRealEventAt).toBeNull();
    // 연결 테스트도 sim 이 아닌 이벤트라 hasRecentEvent 는 기존 의미를 유지해요.
    expect(json.hasRecentEvent).toBe(true);
  });

  it("lite=1 은 목록·미배정 count 쿼리 없이 실제 이벤트만 조회해요", async () => {
    const { admin, calls } = makeAdmin({ events: [REAL] });
    getAgentAdmin.mockReturnValue(admin);

    const { GET } = await import("./route");
    const res = await GET(
      new Request("http://localhost/api/agent/automation-status?lite=1")
    );
    const json = (await res.json()) as {
      recentEvents: unknown[];
      unassignedCount: number;
      hasRecentEvent: boolean;
      lastRealEventAt: string | null;
    };
    expect(json.recentEvents).toEqual([]);
    expect(json.unassignedCount).toBe(0);
    expect(json.hasRecentEvent).toBe(true);
    expect(json.lastRealEventAt).toBe(REAL.created_at);
    expect(calls).toHaveLength(1);
  });
});
