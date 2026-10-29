import { NextResponse } from "next/server";
import { combineShareText } from "@/lib/ledger/share-inbox";

/** Fallback when the service worker is not controlling yet. */
export async function POST(request: Request) {
  let title = "";
  let text = "";
  let url = "";
  try {
    const formData = await request.formData();
    title = String(formData.get("title") ?? "").slice(0, 2000);
    text = String(formData.get("text") ?? "").slice(0, 2000);
    url = String(formData.get("url") ?? "").slice(0, 2000);
  } catch {
    /* ignore malformed body */
  }

  const combined = combineShareText({ title, text, url });
  const redirectUrl = new URL("/share-target", request.url);
  if (combined) redirectUrl.searchParams.set("text", combined);
  return NextResponse.redirect(redirectUrl, 303);
}
