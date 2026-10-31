import { NextResponse } from "next/server";
import { extractReceiptFromImage } from "@/lib/agent/receipt-vision";
import { receiptMaxImageBytes } from "@/lib/ledger/image-limits";
import { guardApi } from "@/lib/security/guard";
import { createServerSupabase } from "@/lib/supabase/server";

export const maxDuration = 60;

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function mimeFromFile(file: File): string | null {
  const type = (file.type || "").toLowerCase();
  if (ALLOWED_MIME.has(type)) return type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  return null;
}

/** 즉시 확인 시트용 — 이벤트/Storage/중복 정책을 타지 않는다. (기본 경로는 /api/events/upload) */
export async function POST(request: Request) {
  const guard = await guardApi(request, { bucket: "ledger-vision" });
  if (guard instanceof NextResponse) return guard;
  const { identity, clientKey } = guard;

  if (identity.kind === "guest") {
    return NextResponse.json({ error: "login-required" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid-form" }, { status: 400 });
  }

  const tripId = String(form.get("tripId") ?? "").trim();
  const image = form.get("image");
  if (!tripId || !(image instanceof File)) {
    return NextResponse.json({ error: "invalid-body" }, { status: 400 });
  }

  const mime = mimeFromFile(image);
  if (!mime) {
    return NextResponse.json({ error: "unsupported-mime" }, { status: 400 });
  }

  const maxBytes = receiptMaxImageBytes();
  if (image.size <= 0 || image.size > maxBytes) {
    return NextResponse.json({ error: "image-too-large" }, { status: 413 });
  }

  const supabase = await createServerSupabase();
  const { data: tripMeta, error: tripErr } = await supabase.rpc(
    "get_ledger_trip",
    { p_trip_id: tripId }
  );
  if (tripErr || !tripMeta) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const meta = tripMeta as { localCurrency?: string | null };
  const localCurrency = (meta.localCurrency ?? "KRW").toUpperCase();

  const buffer = Buffer.from(await image.arrayBuffer());

  const result = await extractReceiptFromImage({
    base64: buffer.toString("base64"),
    mime,
    userId: clientKey,
    tripId,
    hintCurrency: localCurrency,
  });

  if (!result.ok) {
    switch (result.error) {
      case "no_api_key":
        return NextResponse.json({ error: "vision-unavailable" }, { status: 503 });
      case "image_too_large":
        return NextResponse.json({ error: "image-too-large" }, { status: 413 });
      case "vision_invalid":
        return NextResponse.json({ error: "vision-invalid" }, { status: 502 });
      case "not_receipt":
        return NextResponse.json({
          draft: null,
          rawExtract: result.extract ?? null,
          rejected: { reason: "not-receipt" },
        });
      default:
        return NextResponse.json(
          { error: "vision-failed", detail: result.detail },
          { status: 502 }
        );
    }
  }

  console.info(
    JSON.stringify({
      route: "ledger/receipt",
      tripIdLen: tripId.length,
      imageBytes: image.size,
      mime,
      source: "ai",
    })
  );

  return NextResponse.json({ draft: result.draft, rawExtract: result.extract });
}
