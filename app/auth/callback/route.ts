import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { resolveSiteOrigin } from "@/lib/site-url";

function htmlEscape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/** Avoid 302-to-cached-/ ; hand the browser a fresh document that hard-navigates. */
function completeLoginResponse(targetUrl: string) {
  const safeTarget = htmlEscape(targetUrl);
  const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="Cache-Control" content="no-store, no-cache, must-revalidate" />
  <title>로그인 완료</title>
</head>
<body style="font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;background:#F8F9FF;color:#111">
  <p>로그인 완료. 최신 화면으로 이동 중…</p>
  <script>
    (async function () {
      try {
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map(function (r) { return r.unregister(); }));
        }
      } catch (e) {}
      try {
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map(function (k) { return caches.delete(k); }));
        }
      } catch (e) {}
      window.location.replace("${safeTarget}");
    })();
  </script>
  <noscript><a href="${safeTarget}">계속하기</a></noscript>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
      "Clear-Site-Data": '"cache"',
    },
  });
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/";
  const next = nextParam.startsWith("/") ? nextParam : "/";
  const errorDescription = searchParams.get("error_description");
  const siteOrigin = resolveSiteOrigin(origin);

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
      return completeLoginResponse(
        `${siteOrigin}${next}${joiner}_b=${bust}`
      );
    }
    return NextResponse.redirect(
      `${siteOrigin}/login?error=${encodeURIComponent(error.message)}`
    );
  }

  return NextResponse.redirect(`${siteOrigin}/login?error=missing_code`);
}
