import { beforeEach, describe, expect, it, vi } from "vitest";

const guardApi = vi.fn();
const rejectAnonymousWrite = vi.fn();
const previewTripRebalance = vi.fn();
const ensureOpenRebalanceSuggestion = vi.fn();
const acceptSuggestion = vi.fn();
const createServerSupabase = vi.fn();
const readJsonLimited = vi.fn();

vi.mock("@/lib/security/guard", () => ({
  guardApi: (...a: unknown[]) => guardApi(...a),
  rejectAnonymousWrite: (...a: unknown[]) => rejectAnonymousWrite(...a),
}));
vi.mock("@/lib/agent/rebalance-preview", () => ({
  previewTripRebalance: (...a: unknown[]) => previewTripRebalance(...a),
  ensureOpenRebalanceSuggestion: (...a: unknown[]) =>
    ensureOpenRebalanceSuggestion(...a),
}));
vi.mock("@/lib/agent/accept-suggestion", () => ({
  acceptSuggestion: (...a: unknown[]) => acceptSuggestion(...a),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: (...a: unknown[]) => createServerSupabase(...a),
}));
vi.mock("@/lib/agent/body-limit", () => ({
  readJsonLimited: (...a: unknown[]) => readJsonLimited(...a),
}));

import { POST } from "./route";

const TRIP = "22222222-2222-4222-8222-222222222222";
const USER = "33333333-3333-4333-8333-333333333333";

function req(body: unknown) {
  return new Request(`http://localhost/api/trips/${TRIP}/rebalance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/trips/[id]/rebalance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guardApi.mockResolvedValue({
      identity: { kind: "user", userId: USER, isAnonymous: false },
    });
    rejectAnonymousWrite.mockReturnValue(null);
    readJsonLimited.mockImplementation(async (r: Request) => ({
      ok: true,
      json: await r.json(),
    }));
    createServerSupabase.mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { id: TRIP, user_id: USER },
              error: null,
            }),
          }),
        }),
      }),
    });
  });

  it("preview 는 조정안을 돌려줘요", async () => {
    previewTripRebalance.mockResolvedValue({
      shouldSuggest: true,
      message: "줄여요",
      adjustmentsLog: ["A: 줄임"],
      overCategories: ["food"],
      remainingBudgetKrw: 100_000,
      remainingScheduleEstKrw: 150_000,
      gapKrw: 50_000,
      droppedCount: 1,
      adjustedItems: [],
      planVersion: 1,
      openSuggestionId: null,
    });
    const res = await POST(req({ action: "preview" }), {
      params: Promise.resolve({ id: TRIP }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.shouldSuggest).toBe(true);
    expect(json.adjustmentsLog).toEqual(["A: 줄임"]);
  });

  it("호스트가 아니면 403", async () => {
    createServerSupabase.mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { id: TRIP, user_id: "other" },
              error: null,
            }),
          }),
        }),
      }),
    });
    const res = await POST(req({ action: "preview" }), {
      params: Promise.resolve({ id: TRIP }),
    });
    expect(res.status).toBe(403);
  });

  it("apply 는 Suggestion 수락까지 가요", async () => {
    ensureOpenRebalanceSuggestion.mockResolvedValue({
      ok: true,
      suggestionId: "44444444-4444-4444-8444-444444444444",
      created: true,
      preview: { shouldSuggest: true, adjustmentsLog: ["x"] },
    });
    acceptSuggestion.mockResolvedValue({ ok: true, type: "rebalance" });
    const res = await POST(req({ action: "apply" }), {
      params: Promise.resolve({ id: TRIP }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.applied).toBe(true);
    expect(ensureOpenRebalanceSuggestion).toHaveBeenCalledWith(
      expect.objectContaining({ replaceOpen: true })
    );
    expect(acceptSuggestion).toHaveBeenCalled();
  });
});
