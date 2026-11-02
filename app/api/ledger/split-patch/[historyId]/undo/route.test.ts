import { beforeEach, describe, expect, it, vi } from "vitest";

const HIST = "55555555-5555-4555-8555-555555555555";

const guardApi = vi.fn();
const rpc = vi.fn();

vi.mock("@/lib/security/guard", () => ({
  guardApi: (...a: unknown[]) => guardApi(...a),
}));
vi.mock("@/lib/agent/admin", () => ({
  getAgentAdmin: () => ({ rpc }),
}));

function call(id: string) {
  return import("./route").then(({ POST }) =>
    POST(
      new Request(`http://localhost/api/ledger/split-patch/${id}/undo`, {
        method: "POST",
      }),
      { params: Promise.resolve({ historyId: id }) }
    )
  );
}

describe("POST /api/ledger/split-patch/[historyId]/undo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    guardApi.mockResolvedValue({
      identity: { kind: "user", userId: "user-1" },
      clientKey: "k",
    });
    rpc.mockResolvedValue({ data: { ok: true, already: false }, error: null });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("게스트는 401", async () => {
    guardApi.mockResolvedValue({
      identity: { kind: "guest", nonce: "n" },
      clientKey: "k",
    });
    expect((await call(HIST)).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("uuid 가 아니면 400", async () => {
    expect((await call("nope")).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("p_actor 와 historyId 로 RPC 를 부른다", async () => {
    const res = await call(HIST);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, already: false });
    expect(rpc).toHaveBeenCalledWith("agent_undo_split_patch", {
      p_actor: "user-1",
      p_history_id: HIST,
    });
  });

  it("이미 되돌렸으면 멱등 성공", async () => {
    rpc.mockResolvedValue({ data: { ok: true, already: true }, error: null });
    const res = await call(HIST);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, already: true });
  });

  it("그 사이 분담이 또 바뀌었으면 409", async () => {
    rpc.mockResolvedValue({ data: { ok: false, reason: "conflict" }, error: null });
    const res = await call(HIST);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("conflict");
  });

  it("RPC 오류: forbidden 403 / not-found 404 / 그 밖은 500", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "forbidden" } });
    expect((await call(HIST)).status).toBe(403);
    rpc.mockResolvedValue({ data: null, error: { message: "not-found" } });
    expect((await call(HIST)).status).toBe(404);
    rpc.mockResolvedValue({ data: null, error: { message: "db boom" } });
    const res = await call(HIST);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("db boom");
  });
});
