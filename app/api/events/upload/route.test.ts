import { beforeEach, describe, expect, it, vi } from "vitest";

const guardApi = vi.fn();
const assertTripMember = vi.fn();
const runIngest = vi.fn();
const upload = vi.fn();

vi.mock("@/lib/security/guard", () => ({
  guardApi: (...args: unknown[]) => guardApi(...args),
}));
vi.mock("@/lib/agent/membership", () => ({
  assertTripMember: (...args: unknown[]) => assertTripMember(...args),
}));
vi.mock("@/lib/agent/ingest-pipeline", () => ({
  runIngest: (...args: unknown[]) => runIngest(...args),
}));
vi.mock("@/lib/agent/admin", () => ({
  getAgentAdmin: () => ({
    storage: { from: () => ({ upload: (...a: unknown[]) => upload(...a) }) },
  }),
}));

const TRIP = "22222222-2222-4222-8222-222222222222";

const JPEG_HEAD = [0xff, 0xd8, 0xff, 0xe0];

function request(opts: {
  file?: File | null;
  tripId?: string;
}): Request {
  const fd = new FormData();
  fd.set("tripId", opts.tripId ?? TRIP);
  fd.set("source", "upload");
  if (opts.file) fd.set("file", opts.file);
  return new Request("http://localhost/api/events/upload", {
    method: "POST",
    body: fd,
  });
}

function jpegFile(size = 64): File {
  const bytes = new Uint8Array(size);
  bytes.set(JPEG_HEAD);
  return new File([bytes], "receipt.jpg", { type: "image/jpeg" });
}

describe("POST /api/events/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    guardApi.mockResolvedValue({
      identity: { kind: "user", userId: "user-1" },
      clientKey: "user-1",
    });
    assertTripMember.mockResolvedValue({ id: "member-1" });
    upload.mockResolvedValue({ error: null });
    runIngest.mockResolvedValue({
      result: { ok: true, id: "evt-1", duplicate: false },
      status: "received",
      tripId: TRIP,
      scheduled: true,
    });
  });

  it("비로그인(게스트)은 401", async () => {
    guardApi.mockResolvedValue({
      identity: { kind: "guest" },
      clientKey: "g",
    });
    const { POST } = await import("./route");
    const res = await POST(request({ file: jpegFile() }));
    expect(res.status).toBe(401);
    expect(upload).not.toHaveBeenCalled();
  });

  it("여행 멤버가 아니면 403", async () => {
    assertTripMember.mockResolvedValue(null);
    const { POST } = await import("./route");
    const res = await POST(request({ file: jpegFile() }));
    expect(res.status).toBe(403);
    expect(upload).not.toHaveBeenCalled();
    expect(runIngest).not.toHaveBeenCalled();
  });

  it("5MB 파일은 413", async () => {
    const { POST } = await import("./route");
    const res = await POST(request({ file: jpegFile(5 * 1024 * 1024) }));
    expect(res.status).toBe(413);
    expect(upload).not.toHaveBeenCalled();
  });

  it("텍스트 파일(매직바이트 불일치)은 400", async () => {
    const fake = new File(["hello, not an image"], "receipt.jpg", {
      type: "image/jpeg",
    });
    const { POST } = await import("./route");
    const res = await POST(request({ file: fake }));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("unsupported-image");
    expect(upload).not.toHaveBeenCalled();
  });

  it("파일이 없으면 400", async () => {
    const { POST } = await import("./route");
    const res = await POST(request({ file: null }));
    expect(res.status).toBe(400);
  });

  it("정상 업로드는 202 + 이벤트 id, 경로는 사용자/여행 폴더", async () => {
    const { POST } = await import("./route");
    const res = await POST(request({ file: jpegFile() }));
    expect(res.status).toBe(202);
    const json = (await res.json()) as { eventId: string; path: string };
    expect(json.eventId).toBe("evt-1");
    expect(json.path.startsWith(`user-1/${TRIP}/`)).toBe(true);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(runIngest).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "image",
        source: "upload",
        payload: { path: json.path, mime: "image/jpeg" },
      })
    );
  });
});
