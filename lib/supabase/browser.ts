"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tryGetPublicSupabaseEnv } from "@/lib/supabase/env";

let browserClient: SupabaseClient | null = null;

/**
 * Browser singleton (anon/publishable key only).
 * Retries env detection when client is still null,
 * so users can fix .env.local without hard-stuck state.
 */
export function getBrowserSupabase(): SupabaseClient | null {
  if (browserClient) return browserClient;

  const env = tryGetPublicSupabaseEnv();
  if (!env) {
    console.warn(
      "[supabase] NEXT_PUBLIC_SUPABASE_URL / PUBLISHABLE(or ANON) key missing"
    );
    return null;
  }

  browserClient = createBrowserClient(env.url, env.anonKey);
  return browserClient;
}

/** 로그아웃 후 stale 세션 캐시 방지 */
export function resetBrowserSupabase() {
  browserClient = null;
}

/** 브라우저 localStorage 에 남은 Supabase 세션 토큰 제거 */
export function clearSupabaseAuthStorage() {
  if (typeof window === "undefined") return;

  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key && key.startsWith("sb-")) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => {
    localStorage.removeItem(key);
  });
}

/** @supabase/ssr 브라우저 클라이언트가 쓰는 쿠키 세션 제거 */
export function clearSupabaseAuthCookies() {
  if (typeof document === "undefined") return;

  const cookieNames = document.cookie
    .split(";")
    .map((part) => part.trim().split("=")[0])
    .filter((name) => name.startsWith("sb-"));

  const host = window.location.hostname;
  for (const name of cookieNames) {
    document.cookie = `${name}=; Max-Age=0; path=/`;
    document.cookie = `${name}=; Max-Age=0; path=/; domain=${host}`;
    document.cookie = `${name}=; Max-Age=0; path=/; domain=.${host}`;
  }
}
