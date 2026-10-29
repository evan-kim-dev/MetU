import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;

/**
 * Server-only Supabase client (service role).
 * Only this module may read SUPABASE_SERVICE_ROLE_KEY.
 * Use in Route Handlers / agent IO — never import from client components.
 */
export function getAgentAdmin(): SupabaseClient | null {
  if (adminClient) return adminClient;

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  adminClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}

/** @deprecated Prefer getAgentAdmin — kept for gradual migration aliases */
export function getServiceSupabase(): SupabaseClient | null {
  return getAgentAdmin();
}
