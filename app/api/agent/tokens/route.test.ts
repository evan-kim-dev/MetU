import { beforeEach, describe, expect, it, vi } from "vitest";

const guardApi = vi.fn();
const getAgentAdmin = vi.fn();
const assertTripMember = vi.fn();
const issueTokenPlaintext = vi.fn(() => "metu-AAAA-BBBB-CCCC-DDDD");
const hashIngestToken = vi.fn((_plain: string) => "hash");

vi.mock("@/lib/security/guard", () => ({
  guardApi: (...args: unknown[]) => guardApi(...args),
}));
vi.mock("@/lib/agent/admin", () => ({
  getAgentAdmin: () => getAgentAdmin(),
}));
vi.mock("@/lib/agent/membership", () => ({
  assertTripMember: (...args: unknown[]) => assertTripMember(...args),
}));
vi.mock("@/lib/agent/tokens", () => ({
  issueTokenPlaintext: () => issueTokenPlaintext(),
  hashIngestToken: (plain: string) => hashIngestToken(plain),
}));
vi.mock("@/lib/agent/body-limit", () => ({
  readJsonLimited: async (req: Request) => {
    const json = await req.json();
    return { ok: true as const, json };
  },
}));

function chainInsert(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn(async () => result);
  const select = vi.fn(() => ({ maybeSingle }));
  const insert = vi.fn(() => ({ select }));
  return { insert, select, maybeSingle };
}

function chainUpdate(result: { data: unknown; error: unknown }) {
  const select = vi.fn(async () => result);
  const neq = vi.fn(() => ({ select }));
  const is = vi.fn(() => ({ neq }));
  const eqLabel = vi.fn(() => ({ is }));
  const eqUser = vi.fn(() => ({ eq: eqLabel }));
  const update = vi.fn(() => ({ eq: eqUser }));
  return { update, eqUser, eqLabel, is, neq, select };
}

describe("POST /api/agent/tokens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guardApi.mockResolvedValue({
      identity: { kind: "user", userId: "user-1" },
    });
  });

  it("default does not revoke", async () => {
    const ins = chainInsert({
      data: { id: "new-1", created_at: "t" },
      error: null,
    });
    const upd = chainUpdate({ data: [], error: null });
    getAgentAdmin.mockReturnValue({
      from: () => ({ insert: ins.insert, update: upd.update }),
    });

    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/agent/tokens", {
        method: "POST",
        body: JSON.stringify({ label: "iPhone 단축어" }),
      })
    );
    const json = (await res.json()) as {
      token: string;
      revokedCount: number;
      warning: string;
    };
    expect(json.token).toBe("metu-AAAA-BBBB-CCCC-DDDD");
    expect(json.revokedCount).toBe(0);
    expect(json.warning).toContain("연결 코드");
    expect(upd.update).not.toHaveBeenCalled();
  });

  it("replaceExisting:true updates same-label tokens only", async () => {
    const ins = chainInsert({
      data: { id: "new-2", created_at: "t" },
      error: null,
    });
    const upd = chainUpdate({
      data: [{ id: "old-1" }, { id: "old-2" }],
      error: null,
    });
    getAgentAdmin.mockReturnValue({
      from: () => ({ insert: ins.insert, update: upd.update }),
    });

    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/agent/tokens", {
        method: "POST",
        body: JSON.stringify({
          label: "iPhone 단축어",
          replaceExisting: true,
        }),
      })
    );
    const json = (await res.json()) as { revokedCount: number };
    expect(upd.update).toHaveBeenCalled();
    expect(json.revokedCount).toBe(2);
  });

  it("insert error skips revoke", async () => {
    const ins = chainInsert({ data: null, error: { message: "fail" } });
    const upd = chainUpdate({ data: [], error: null });
    getAgentAdmin.mockReturnValue({
      from: () => ({ insert: ins.insert, update: upd.update }),
    });

    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/agent/tokens", {
        method: "POST",
        body: JSON.stringify({
          label: "iPhone 단축어",
          replaceExisting: true,
        }),
      })
    );
    expect(res.status).toBe(500);
    expect(upd.update).not.toHaveBeenCalled();
  });
});
