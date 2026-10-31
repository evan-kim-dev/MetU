import { beforeEach, describe, expect, it, vi } from "vitest";

const getOrSet = vi.fn();
const aiChatOrNull = vi.fn();

vi.mock("@/lib/server/cache", () => ({
  getOrSet: (...args: unknown[]) => getOrSet(...args),
}));

vi.mock("@/lib/ai/chat-client", () => ({
  aiChatOrNull: (...args: unknown[]) => aiChatOrNull(...args),
}));

describe("assignDocsChecklistIds + resolveDocsChecklist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preserves known fallback ids and prefixes new ones with ai-", async () => {
    const { assignDocsChecklistIds } = await import(
      "@/lib/checklist/country-docs"
    );
    const docs = assignDocsChecklistIds("japan", [
      { label: "여권(유효기간 확인)", required: true },
      { label: "왕복 항공권 E-티켓", required: true },
      { id: "visitjapan", label: "Visit Japan 등록 QR (권장)", required: false },
      { label: "현금 소지 증빙", required: false, tip: "입국 심사 시" },
    ]);
    expect(docs.find((d) => d.label.includes("여권"))?.id).toBe("passport");
    expect(docs.find((d) => d.label.includes("항공권"))?.id).toBe(
      "return-ticket"
    );
    expect(docs.find((d) => d.id === "visitjapan")).toBeTruthy();
    const custom = docs.find((d) => d.label.includes("현금"));
    expect(custom?.id.startsWith("ai-")).toBe(true);
  });

  it("keeps stored checklist ids when AI repeats known labels", async () => {
    const { assignDocsChecklistIds, COUNTRY_DOCS } = await import(
      "@/lib/checklist/country-docs"
    );
    const storedChecked = { passport: true, esta: true };
    const docs = assignDocsChecklistIds("usa", [
      { label: "여권 유효기간 6개월 이상", required: true },
      { label: "ESTA 승인 화면 캡처", required: true },
      { label: "왕복 항공권", required: true },
      { label: "코로나 관련 서류(예시)", required: false },
    ]);
    for (const id of Object.keys(storedChecked)) {
      expect(docs.some((d) => d.id === id)).toBe(true);
    }
    // baseline fallback ids still exist in COUNTRY_DOCS
    expect(COUNTRY_DOCS.usa.docs.map((d) => d.id)).toContain("passport");
  });

  it("resolveDocsChecklist returns AI docs via cache factory", async () => {
    getOrSet.mockImplementation(
      async (
        _key: string,
        _ttl: number,
        fn: () => Promise<{ docs: unknown }>
      ) => {
        const value = await fn();
        return { value, hit: "miss", fetchedAt: new Date().toISOString() };
      }
    );
    aiChatOrNull.mockResolvedValue({
      content: JSON.stringify({
        docs: [
          { label: "여권(유효기간 확인)", required: true },
          { label: "왕복 항공권 E-티켓", required: true },
          { label: "디지털 노마드 비자 확인서", required: false },
        ],
      }),
      source: "ai",
      validated: true,
      cached: false,
    });

    const { resolveDocsChecklist } = await import("@/lib/checklist/docs-ai");
    const result = await resolveDocsChecklist("japan");
    expect(result.source).toBe("ai");
    expect(result.docs.some((d) => d.id === "passport")).toBe(true);
    expect(result.docs.some((d) => d.id.startsWith("ai-"))).toBe(true);
    expect(getOrSet).toHaveBeenCalledWith(
      "docs-checklist:v1:japan",
      7 * 24 * 60 * 60,
      expect.any(Function),
      { staleIfError: true }
    );
  });

  it("falls back to COUNTRY_DOCS when AI empty", async () => {
    getOrSet.mockImplementation(
      async (
        _key: string,
        _ttl: number,
        fn: () => Promise<unknown>
      ) => {
        await fn();
        throw new Error("unreachable");
      }
    );
    aiChatOrNull.mockResolvedValue(null);

    const { resolveDocsChecklist } = await import("@/lib/checklist/docs-ai");
    const { COUNTRY_DOCS } = await import("@/lib/checklist/country-docs");
    const result = await resolveDocsChecklist("thailand");
    expect(result.source).toBe("fallback");
    expect(result.docs).toEqual(COUNTRY_DOCS.thailand.docs);
  });
});
