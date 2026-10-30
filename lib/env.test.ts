import { afterEach, describe, expect, it } from "vitest";
import { getServerEnv, resetServerEnvCacheForTests } from "@/lib/env";

describe("getServerEnv", () => {
  afterEach(() => {
    resetServerEnvCacheForTests();
  });

  it("reads trimmed optional values without throwing", () => {
    const prev = process.env.AGENT_INGEST_PEPPER;
    process.env.AGENT_INGEST_PEPPER = "  pepper  ";
    resetServerEnvCacheForTests();
    const env = getServerEnv();
    expect(env.AGENT_INGEST_PEPPER).toBe("pepper");
    if (prev === undefined) delete process.env.AGENT_INGEST_PEPPER;
    else process.env.AGENT_INGEST_PEPPER = prev;
  });
});

