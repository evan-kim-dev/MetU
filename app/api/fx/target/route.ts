import { NextResponse } from "next/server";
import { resolveTripCurrency } from "@/lib/fx/resolve-trip-currency";
import { guardApi } from "@/lib/security/guard";

export async function GET(request: Request) {
  const guard = await guardApi(request, { bucket: "places" });
  if (guard instanceof NextResponse) return guard;

  const { searchParams } = new URL(request.url);
  const country = searchParams.get("country");
  const destination = searchParams.get("destination");

  try {
    const target = await resolveTripCurrency({ country, destination });
    return NextResponse.json(target, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (err) {
    console.error("[api/fx/target]", err);
    return NextResponse.json(
      { error: "fx-target-unavailable" },
      { status: 503 }
    );
  }
}
