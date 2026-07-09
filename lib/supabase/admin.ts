/**
 * Admin / service-role client intentionally lives on FastAPI only.
 * Importing this from Next client or server code throws at module load.
 *
 * Use: backend/app/db/supabase.py
 */
export function getAdminSupabase(): never {
  throw new Error(
    "[supabase] Admin/service_role client is not available in Next.js. " +
      "Call FastAPI (BACKEND_URL) for privileged operations."
  );
}
