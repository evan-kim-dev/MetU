// @vitest-environment jsdom
import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listExpenses = vi.fn();
const listVoidedExpenseIds = vi.fn();

vi.mock("@/lib/supabase/browser", () => ({
  getBrowserSupabase: () => ({}),
}));
vi.mock("@/lib/ledger/supabase", () => ({
  listExpenses: (...a: unknown[]) => listExpenses(...a),
  listVoidedExpenseIds: (...a: unknown[]) => listVoidedExpenseIds(...a),
}));

import { SplitPatchBox } from "@/components/ledger/SplitPatchBox";

const EXP = "22222222-2222-4222-8222-222222222222";

const PATCH = {
  expenseId: EXP,
  exclude: ["m-c"],
  only: [],
  weights: [],
  itemExclusions: [],
  clarification: null,
};

const PREVIEW_OK = {
  ok: true,
  needsClarification: false,
  patch: PATCH,
  preview: {
    expenseId: EXP,
    label: "이자카야",
    kind: "exclude",
    before: [
      { memberId: "m-a", name: "민수", krw: 10000 },
      { memberId: "m-b", name: "지영", krw: 10000 },
      { memberId: "m-c", name: "철수", krw: 10000 },
    ],
    after: [
      { memberId: "m-a", name: "민수", krw: 15000 },
      { memberId: "m-b", name: "지영", krw: 15000 },
    ],
    beforeDigest: "digest-1",
  },
};

function jsonRes(status: number, body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  );
}

const fetchMock = vi.fn();

async function openAndPreview() {
  fireEvent.click(screen.getByRole("button", { name: "말로 분담 바꾸기" }));
  await screen.findByLabelText("지출 고르기");
  fireEvent.change(screen.getByLabelText("어떻게 바꿀까요?"), {
    target: { value: "철수는 빼 주세요" },
  });
  fireEvent.click(screen.getByRole("button", { name: "미리보기" }));
}

describe("SplitPatchBox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    listExpenses.mockResolvedValue([
      { id: EXP, merchant: "이자카야", label: "저녁", krwAmount: 30000 },
      { id: "gone", merchant: "취소건", label: "", krwAmount: 1000 },
    ]);
    listVoidedExpenseIds.mockResolvedValue(new Set(["gone"]));
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("처음에는 버튼만 보이고, 음성 입력은 없다", () => {
    render(<SplitPatchBox tripId="trip-1" />);
    expect(screen.getByRole("button", { name: "말로 분담 바꾸기" })).toBeTruthy();
    expect(screen.queryByText(/음성/)).toBeNull();
    expect(listExpenses).not.toHaveBeenCalled();
  });

  it("취소된 지출은 목록에서 빼고, 미리보기에서 서버가 계산한 분담을 보여준다", async () => {
    fetchMock.mockImplementation(() => jsonRes(200, PREVIEW_OK));
    render(<SplitPatchBox tripId="trip-1" />);
    await openAndPreview();

    await screen.findByText("바꾼 뒤");
    expect(screen.getAllByText("₩15,000").length).toBe(2);
    expect(screen.queryByText(/취소건/)).toBeNull();

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/ledger/split-patch");
    expect(JSON.parse(init.body as string)).toEqual({
      expenseId: EXP,
      tripId: "trip-1",
      text: "철수는 빼 주세요",
    });
  });

  it("적용 요청에는 patch/digest/키만 보내고 금액은 보내지 않는다 → 되돌리기까지", async () => {
    const onChanged = vi.fn();
    fetchMock
      .mockImplementationOnce(() => jsonRes(200, PREVIEW_OK))
      .mockImplementationOnce(() => jsonRes(200, { ok: true, historyId: "h-1" }))
      .mockImplementationOnce(() => jsonRes(200, { ok: true }));
    render(<SplitPatchBox tripId="trip-1" onChanged={onChanged} />);
    await openAndPreview();
    fireEvent.click(await screen.findByRole("button", { name: "적용하기" }));

    await screen.findByText(/분담을 바꿨어요/);
    const applyBody = JSON.parse(fetchMock.mock.calls[1]![1].body as string);
    expect(Object.keys(applyBody).sort()).toEqual([
      "beforeDigest",
      "idempotencyKey",
      "patch",
    ]);
    expect(applyBody.patch).toEqual(PATCH);
    expect(applyBody.beforeDigest).toBe("digest-1");
    expect(applyBody.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
    expect(onChanged).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "되돌리기" }));
    await screen.findByText(/원래대로 되돌렸어요/);
    expect(fetchMock.mock.calls[2]![0]).toBe("/api/ledger/split-patch/h-1/undo");
    expect(onChanged).toHaveBeenCalledTimes(2);
  });

  it("모호하면 되묻는 말을 보여준다", async () => {
    fetchMock.mockImplementation(() =>
      jsonRes(200, { ok: true, needsClarification: true, message: "누구를 빼요?" })
    );
    render(<SplitPatchBox tripId="trip-1" />);
    await openAndPreview();
    await screen.findByText("누구를 빼요?");
    expect(screen.queryByRole("button", { name: "적용하기" })).toBeNull();
  });

  it("서버 오류는 한국어 문구로 보여준다", async () => {
    fetchMock.mockImplementation(() =>
      jsonRes(503, { error: "ai-unavailable" })
    );
    render(<SplitPatchBox tripId="trip-1" />);
    await openAndPreview();
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toMatch(/쓸 수 없어요/)
    );
  });

  it("적용 중 충돌(409)이면 미리보기를 닫고 안내한다", async () => {
    fetchMock
      .mockImplementationOnce(() => jsonRes(200, PREVIEW_OK))
      .mockImplementationOnce(() => jsonRes(409, { error: "conflict" }));
    render(<SplitPatchBox tripId="trip-1" />);
    await openAndPreview();
    fireEvent.click(await screen.findByRole("button", { name: "적용하기" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toMatch(/그 사이 분담이 바뀌었어요/)
    );
    expect(screen.queryByRole("button", { name: "적용하기" })).toBeNull();
  });
});
