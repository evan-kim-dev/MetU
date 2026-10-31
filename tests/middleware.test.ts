import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getUser = vi.fn();
const from = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: () => getUser() },
    from: (...args: unknown[]) => from(...args),
  }),
}));

vi.mock("@/lib/supabase/env", () => ({
  getPublicSupabaseKey: () => "test-anon-key",
}));

function req(path: string): NextRequest {
  return new NextRequest(`https://metu.test${path}`);
}

describe("middleware (자동 기록 하드 게이트 제거)", () => {
  beforeEach(() => {
    vi.resetModules();
    getUser.mockReset();
    from.mockReset();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  });

  it("pending 사용자가 /trips 를 열어도 리다이렉트하지 않고 DB 도 조회하지 않아요", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const { middleware } = await import("../middleware");
    for (const path of ["/", "/trips", "/agent", "/trips/abc"]) {
      const res = await middleware(req(path));
      expect(res.headers.get("location"), path).toBeNull();
      expect(res.status, path).toBe(200);
    }
    expect(from).not.toHaveBeenCalled();
  });

  it("로그아웃 사용자는 /login?next=… 로 보내요", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { middleware } = await import("../middleware");
    const res = await middleware(req("/trips"));
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location") ?? "");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/trips");
  });

  it("로그아웃 사용자도 /about, /s/x, /trips/share/x 는 통과해요", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { middleware } = await import("../middleware");
    for (const path of ["/about", "/s/abc", "/trips/share/abc"]) {
      const res = await middleware(req(path));
      expect(res.headers.get("location"), path).toBeNull();
    }
  });
});
