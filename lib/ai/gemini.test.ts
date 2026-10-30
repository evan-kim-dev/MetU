import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  geminiStructured,
  setGeminiClientForTests,
  type GeminiInteractionsClient,
} from "@/lib/ai/gemini";
import {
  __resetMemoryUsageSinkForTests,
  resetUsageSinkForTests,
} from "@/lib/ai/usage";

const Schema = z.object({
  answer: z.number(),
});

beforeEach(() => {
  __resetMemoryUsageSinkForTests();
  resetUsageSinkForTests();
});

afterEach(() => {
  setGeminiClientForTests(null);
  delete process.env.GEMINI_API_KEY;
  __resetMemoryUsageSinkForTests();
  resetUsageSinkForTests();
});

describe("geminiStructured", () => {
  it("returns no_api_key when key and client are missing", async () => {
    const res = await geminiStructured({
      model: "fast",
      system: "sys",
      input: "2+2",
      schema: Schema,
      purpose: "test",
      userId: "u1",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("no_api_key");
  });

  it("retries once after zod failure then returns ok:false", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce({
        id: "1",
        output_text: JSON.stringify({ answer: "nope" }),
        usage: { total_input_tokens: 1, total_output_tokens: 1 },
      })
      .mockResolvedValueOnce({
        id: "2",
        output_text: JSON.stringify({ answer: "still-bad" }),
        usage: { total_input_tokens: 1, total_output_tokens: 1 },
      });

    setGeminiClientForTests({
      interactions: { create },
    } as GeminiInteractionsClient);

    const res = await geminiStructured({
      model: "fast",
      system: "sys",
      input: "2+2",
      schema: Schema,
      purpose: "test",
      userId: "u1",
    });

    expect(create).toHaveBeenCalledTimes(2);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("zod_failed");
  });

  it("retries on 429 up to GEMINI_MAX_RETRIES then succeeds", async () => {
    process.env.GEMINI_MAX_RETRIES = "2";
    const err429 = Object.assign(new Error("rate limited"), { status: 429 });
    const create = vi
      .fn()
      .mockRejectedValueOnce(err429)
      .mockRejectedValueOnce(err429)
      .mockResolvedValueOnce({
        id: "3",
        output_text: JSON.stringify({ answer: 4 }),
        usage: { total_input_tokens: 2, total_output_tokens: 1 },
      });

    setGeminiClientForTests({
      interactions: { create },
    } as GeminiInteractionsClient);

    const res = await geminiStructured({
      model: "fast",
      system: "sys",
      input: "2+2",
      schema: Schema,
      purpose: "test",
      userId: "u1",
    });

    expect(create).toHaveBeenCalledTimes(3);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.answer).toBe(4);
  });
});
