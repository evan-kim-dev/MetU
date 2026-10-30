import { afterEach, describe, expect, it } from "vitest";

import {
  hashIngestToken,
  issueTokenPlaintext,
  LEGACY_TOKEN_PREFIX,
  normalizeIngestToken,
  TOKEN_PREFIX,
} from "@/lib/agent/tokens";
import {
  defaultSmsIdempotencyKey,
  minuteBucketIso,
} from "@/lib/agent/ingest";
import { detectImageMime } from "@/lib/agent/image-magic";
import { z } from "zod";

afterEach(() => {
  delete process.env.AGENT_INGEST_PEPPER;
});

describe("ingest tokens", () => {
  it("issues metu- Crockford groups and hashes with pepper", () => {
    process.env.AGENT_INGEST_PEPPER = "pepper-a";
    const plain = issueTokenPlaintext();
    expect(plain.startsWith(TOKEN_PREFIX)).toBe(true);
    expect(plain).toMatch(
      /^metu-[0-9A-HJKMNP-TV-Z]{4}(?:-[0-9A-HJKMNP-TV-Z]{4}){3}$/
    );
    expect(plain).not.toMatch(/[ILOU]/);
    const h1 = hashIngestToken(plain);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
    process.env.AGENT_INGEST_PEPPER = "pepper-b";
    const h2 = hashIngestToken(plain);
    expect(h2).not.toBe(h1);
  });

  it("normalizes lowercase metu- input to the issued form", () => {
    process.env.AGENT_INGEST_PEPPER = "pepper-a";
    const issued = issueTokenPlaintext();
    const lower = issued.toLowerCase();
    expect(normalizeIngestToken(`  ${lower}  `)).toBe(issued);
    expect(hashIngestToken(normalizeIngestToken(lower)!)).toBe(
      hashIngestToken(issued)
    );
  });

  it("accepts legacy mtu_ format without altering case", () => {
    const legacy = `${LEGACY_TOKEN_PREFIX}AbCdEfGhIjKlMnOpQrStUvWxYz0123`;
    expect(legacy.length).toBeGreaterThanOrEqual(20);
    expect(normalizeIngestToken(legacy)).toBe(legacy);
    expect(normalizeIngestToken(` ${legacy} `)).toBe(legacy);
  });

  it("rejects garbage tokens", () => {
    expect(normalizeIngestToken("")).toBeNull();
    expect(normalizeIngestToken("metu-SHORT")).toBeNull();
    expect(normalizeIngestToken("mtu_short")).toBeNull();
    expect(normalizeIngestToken("nope")).toBeNull();
  });

  it("throws when pepper missing", () => {
    delete process.env.AGENT_INGEST_PEPPER;
    expect(() => hashIngestToken("metu-AAAA-BBBB-CCCC-DDDD")).toThrow(/PEPPER/);
  });
});

describe("idempotency", () => {
  it("buckets by minute", () => {
    const a = minuteBucketIso("2026-10-30T01:23:45.000Z");
    const b = minuteBucketIso("2026-10-30T01:23:59.000Z");
    expect(a).toBe(b);
    expect(defaultSmsIdempotencyKey("x", "2026-10-30T01:23:45.000Z")).toBe(
      defaultSmsIdempotencyKey("x", "2026-10-30T01:23:10.000Z")
    );
  });
});

describe("sms ingest zod boundaries", () => {
  const BodySchema = z.object({
    text: z.string().min(1).max(2000),
  });

  it("rejects empty and overlong text", () => {
    expect(BodySchema.safeParse({ text: "" }).success).toBe(false);
    expect(BodySchema.safeParse({ text: "a".repeat(2001) }).success).toBe(
      false
    );
    expect(BodySchema.safeParse({ text: "ok" }).success).toBe(true);
  });
});

describe("image magic", () => {
  it("detects jpeg/png/webp", () => {
    expect(detectImageMime(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe(
      "image/jpeg"
    );
    expect(
      detectImageMime(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]))
    ).toBe("image/png");
    expect(
      detectImageMime(
        Uint8Array.from([
          0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
        ])
      )
    ).toBe("image/webp");
    expect(detectImageMime(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]))).toBe(
      null
    );
  });
});
