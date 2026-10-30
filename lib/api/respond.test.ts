import { describe, expect, it, vi } from "vitest";
import { apiError, apiInternalError } from "@/lib/api/respond";

describe("apiError", () => {
  it("returns { error: code } with status", async () => {
    const res = apiError("validation-failed", 400);
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "validation-failed" });
  });

  it("logs on 5xx without putting log in body", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = apiInternalError(new Error("supabase boom"));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "internal-error" });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
