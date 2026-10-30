import { z } from "zod";

const optionalTrimmed = z
  .string()
  .optional()
  .transform((v) => (typeof v === "string" && v.trim() ? v.trim() : undefined));

const ServerEnvSchema = z.object({
  SUPABASE_URL: optionalTrimmed,
  NEXT_PUBLIC_SUPABASE_URL: optionalTrimmed,
  // SERVICE_ROLE_KEY: read only in lib/agent/admin.ts (inventory enforced).
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalTrimmed,
  AGENT_INGEST_PEPPER: optionalTrimmed,
  CRON_SECRET: optionalTrimmed,
  GUEST_COOKIE_SECRET: optionalTrimmed,
  GEMINI_API_KEY: optionalTrimmed,
  GEMINI_TIMEOUT_MS: optionalTrimmed,
  VAPID_PUBLIC_KEY: optionalTrimmed,
  VAPID_PRIVATE_KEY: optionalTrimmed,
  VAPID_SUBJECT: optionalTrimmed,
  KAKAO_REST_API_KEY: optionalTrimmed,
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

let cached: ServerEnv | null = null;
let warnedMissing = false;

/**
 * Soft-validated server env. Missing required keys are logged once; never throws
 * (app must keep serving — callers decide null/503).
 */
export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = ServerEnvSchema.safeParse(process.env);
  const env: ServerEnv = parsed.success
    ? parsed.data
    : ServerEnvSchema.parse({});
  cached = env;
  if (!parsed.success && !warnedMissing) {
    warnedMissing = true;
    console.error("[getServerEnv] schema", parsed.error.flatten());
  }
  const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url && !warnedMissing) {
    warnedMissing = true;
    console.error(
      "[getServerEnv] SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL missing"
    );
  }
  return env;
}

/** Test helper — clear memoization between cases. */
export function resetServerEnvCacheForTests(): void {
  cached = null;
  warnedMissing = false;
}
