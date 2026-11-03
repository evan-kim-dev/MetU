import { beforeEach, describe, expect, it, vi } from "vitest";

const guardApi = vi.fn();
const createSignedUrl = vi.fn();

vi.mock("@/lib/security/guard", () => ({
  guardApi: (...a: unknown[]) => guardApi(...a),
}));
vi.mock("@/lib/agent/admin", () => ({
  getAgentAdmin: () => ({
    storage: {
      from: () => ({
        createSignedUrl: (...a: unknown[]) => createSignedUrl(...a),
      }),
    },
  }),
}));

function req(body: unknown) {
  return new Request("http://localhost/api/ledger/receipt-url", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/ledger/receipt-url", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guardApi.mockResolvedValue({
      identity: { kind: "user", userId: "user-1" },
      clientKey: "k",
    });
    createSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://example.com/x" },
      error: null,
    });
  });

  it("비로그인 401", async () => {
    guardApi.mockResolvedValue({
      identity: { kind: "guest", nonce: "n" },
      clientKey: "k",
    });
    const { POST } = await import("./route");
    expect((await POST(req({ path: "user-1/a.jpg" }))).status).toBe(401);
  });

  it("남의 경로 403", async () => {
    const { POST } = await import("./route");
    expect((await POST(req({ path: "other/a.jpg" }))).status).toBe(403);
  });

  it("본인 경로 200", async () => {
    const { POST } = await import("./route");
    const res = await POST(req({ path: "user-1/trip/a.jpg" }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { url: string };
    expect(json.url).toContain("https://");
  });
});
