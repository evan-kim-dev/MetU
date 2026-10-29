import "server-only";

/**
 * Re-export only. Service role key lives in `lib/agent/admin.ts`.
 */
export {
  getAgentAdmin as getServiceSupabase,
  getAgentAdmin,
} from "@/lib/agent/admin";
