import { NextResponse } from "next/server";

/**
 * Read request body with a hard byte cap (chunked-safe).
 * content-length is only an early reject hint.
 */
export async function readBodyLimited(
  request: Request,
  maxBytes: number
): Promise<{ ok: true; text: string } | { ok: false; response: NextResponse }> {
  const declared = Number(request.headers.get("content-length") ?? "NaN");
  if (Number.isFinite(declared) && declared > maxBytes) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "payload-too-large" },
        { status: 413 }
      ),
    };
  }

  const reader = request.body?.getReader();
  if (!reader) {
    return { ok: true, text: "" };
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        /* ignore */
      }
      return {
        ok: false,
        response: NextResponse.json(
          { error: "payload-too-large" },
          { status: 413 }
        ),
      };
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.byteLength;
  }
  return { ok: true, text: new TextDecoder("utf-8").decode(merged) };
}

export async function readJsonLimited(
  request: Request,
  maxBytes: number
): Promise<
  | { ok: true; json: unknown }
  | { ok: false; response: NextResponse }
> {
  const body = await readBodyLimited(request, maxBytes);
  if (!body.ok) return body;
  if (!body.text.trim()) {
    return {
      ok: false,
      response: NextResponse.json({ error: "invalid-json" }, { status: 400 }),
    };
  }
  try {
    return { ok: true, json: JSON.parse(body.text) as unknown };
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "invalid-json" }, { status: 400 }),
    };
  }
}
