import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/";
  const next = nextParam.startsWith("/") ? nextParam : "/";
  const errorDescription = searchParams.get("error_description");

  // Prefer canonical site URL so OAuth never lands on a stale preview deployment.
  const siteOrigin = (
    process.env.NEXT_PUBLIC_SITE_URL ?? origin
  ).replace(/\/$/, "");

  if (errorDescription) {
    return NextResponse.redirect(
      `${siteOrigin}/login?error=${encodeURIComponent(errorDescription)}`
    );
  }

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const bust =
        process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ??
        Date.now().toString(36);
      const joiner = next.includes("?") ? "&" : "?";
      const response = NextResponse.redirect(
        `${siteOrigin}${next}${joiner}_b=${bust}`
      );
      response.headers.set(
        "Cache-Control",
        "private, no-cache, no-store, max-age=0, must-revalidate"
      );
      // Drop HTTP/Cache Storage only — do not clear cookies/session.
      response.headers.set("Clear-Site-Data", '"cache"');
      return response;
    }
    return NextResponse.redirect(
      `${siteOrigin}/login?error=${encodeURIComponent(error.message)}`
    );
  }

  return NextResponse.redirect(`${siteOrigin}/login?error=missing_code`);
}
