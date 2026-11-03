import { describe, expect, it, vi } from "vitest";

import { setExpensePayer } from "./supabase";

describe("setExpensePayer", () => {
  it("maps forbidden to Korean host-only copy", async () => {
    const rpc = vi.fn().mockResolvedValue({
      error: { message: "forbidden" },
    });
    const result = await setExpensePayer(
      { rpc } as never,
      "e1",
      "m1"
    );
    expect(result).toEqual({
      ok: false,
      error: "호스트만 바꿀 수 있어요.",
    });
  });

  it("returns ok on success", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const result = await setExpensePayer(
      { rpc } as never,
      "e1",
      "m1"
    );
    expect(result).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("set_expense_payer", {
      p_expense_id: "e1",
      p_member_id: "m1",
    });
  });
});
