import { getBackendUrl } from "@/lib/supabase/env";

export class BackendUnavailableError extends Error {
  constructor(message = "Backend unavailable") {
    super(message);
    this.name = "BackendUnavailableError";
  }
}

export async function backendFetch(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const base = getBackendUrl().replace(/\/$/, "");
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;

  try {
    return await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch (error) {
    throw new BackendUnavailableError(
      error instanceof Error ? error.message : "Backend fetch failed"
    );
  }
}
