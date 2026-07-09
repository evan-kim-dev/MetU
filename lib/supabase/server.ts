import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicSupabaseEnv } from "@/lib/supabase/env";

/**
 * Server Supabase client (Route Handlers / RSC).
 * Cookie-based session for Auth code exchange.
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();
  const { url, anonKey } = getPublicSupabaseEnv();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component — middleware will refresh session.
        }
      },
    },
  });
}

/** @deprecated Prefer createServerSupabase() */
export async function getServerSupabase() {
  return createServerSupabase();
}
