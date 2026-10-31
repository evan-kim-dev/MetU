import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
let admin: { rpc: typeof rpc } | null = { rpc };

vi.mock("@/lib/agent/admin", () => ({ getAgentAdmin: () => admin }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => {
    throw new Error("not used");
  },
}));

import { ensureOwnerMemberAdmin } from "@/lib/agent/membership";

const TRIP = "22222222-2222-4222-8222-222222222222";
const USER = "11111111-1111-4111-8111-111111111111";

describe("ensureOwnerMemberAdmin", () => {
  beforeEach(() => {
    rpc.mockReset();
    admin = { rpc };
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("agent_ensure_owner_member RPC 에 p_actor/p_trip_id 를 넘기고 member id 를 돌려준다", async () => {
    rpc.mockResolvedValue({ data: "member-1", error: null });
    const r = await ensureOwnerMemberAdmin(TRIP, USER);
    expect(r).toEqual({ ok: true, memberId: "member-1" });
    expect(rpc).toHaveBeenCalledWith("agent_ensure_owner_member", {
      p_actor: USER,
      p_trip_id: TRIP,
    });
  });

  it("소유자도 멤버도 아니면 forbidden (오류 로그 없음)", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "forbidden" } });
    const r = await ensureOwnerMemberAdmin(TRIP, USER);
    expect(r).toEqual({ ok: false, error: "forbidden" });
    expect(console.error).not.toHaveBeenCalled();
  });

  it("그 밖의 RPC 오류는 로그를 남기고 ensure-failed", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "db boom" } });
    const r = await ensureOwnerMemberAdmin(TRIP, USER);
    expect(r).toEqual({ ok: false, error: "ensure-failed" });
    expect(console.error).toHaveBeenCalled();
  });

  it("id 가 비어 오면 실패", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await ensureOwnerMemberAdmin(TRIP, USER)).toEqual({
      ok: false,
      error: "ensure-failed",
    });
  });

  it("관리자 클라이언트가 없으면 server-misconfigured", async () => {
    admin = null;
    expect(await ensureOwnerMemberAdmin(TRIP, USER)).toEqual({
      ok: false,
      error: "server-misconfigured",
    });
  });
});
