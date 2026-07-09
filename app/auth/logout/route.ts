import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicSupabaseEnv } from "@/lib/supabase/env";

function purgeSupabaseCookies(request: NextRequest, response: NextResponse) {
  request.cookies.getAll().forEach(({ name }) => {
    if (!name.startsWith("sb-")) return;
    response.cookies.set(name, "", { maxAge: 0, path: "/" });
  });
}

async function signOutResponse(
  request: NextRequest,
  response: NextResponse
): Promise<NextResponse> {
  try {
    const { url, anonKey } = getPublicSupabaseEnv();
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    await supabase.auth.signOut({ scope: "global" });
  } catch {
    /* ignore */
  }

  purgeSupabaseCookies(request, response);
  return response;
}

/** 브라우저 네비게이션으로 호출 — Set-Cookie 가 확실히 반영된 뒤 /login 으로 이동 */
export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  return signOutResponse(request, response);
}

/** fetch 로 호출할 때 사용 */
export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  return signOutResponse(request, response);
}
