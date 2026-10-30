import { NextResponse } from "next/server";

type ApiErrorInit = {
  /** Optional extra JSON fields (never put secrets here). */
  extra?: Record<string, unknown>;
  headers?: HeadersInit;
};

/**
 * Uniform API error envelope: `{ error: code }`.
 * Server details go to console only for 5xx.
 */
export function apiError(
  code: string,
  status: number,
  init?: ApiErrorInit & { log?: unknown }
): NextResponse {
  if (status >= 500 && init?.log !== undefined) {
    console.error(`[apiError:${code}]`, init.log);
  }
  return NextResponse.json(
    { error: code, ...(init?.extra ?? {}) },
    { status, headers: init?.headers }
  );
}

/** Map unexpected/supabase failures to internal-error without leaking messages. */
export function apiInternalError(log: unknown): NextResponse {
  return apiError("internal-error", 500, { log });
}
