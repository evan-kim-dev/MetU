import { describe, expect, it, vi } from "vitest";

import { appendExifFields, readReceiptExif } from "./exif";

describe("readReceiptExif", () => {
  it("returns empty on corrupt bytes without throw", async () => {
    const junk = new Uint8Array([0, 1, 2, 3, 4]);
    await expect(readReceiptExif(junk)).resolves.toEqual({});
  });

  it("returns empty when parse yields null", async () => {
    vi.doMock("exifr", () => ({
      parse: async () => null,
    }));
    const { readReceiptExif: read } = await import("./exif");
    await expect(read(new Uint8Array([0xff, 0xd8]))).resolves.toEqual({});
  });
});

describe("appendExifFields", () => {
  it("skips missing fields", () => {
    const fd = new FormData();
    appendExifFields(fd, {});
    expect(fd.has("exifTakenAt")).toBe(false);
    appendExifFields(fd, {
      takenAt: "2026-11-01T12:00:00.000Z",
      lat: 35.6812,
      lng: 139.7671,
    });
    expect(fd.get("exifTakenAt")).toBe("2026-11-01T12:00:00.000Z");
    expect(fd.get("exifLat")).toBe("35.6812");
  });
});
