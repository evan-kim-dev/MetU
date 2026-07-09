"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

/** Next.js App Router 히스토리에 이전 페이지가 있는지 확인 */
export function canNavigateBack(): boolean {
  if (typeof window === "undefined") return false;
  const idx = window.history.state?.idx;
  return typeof idx === "number" && idx > 0;
}

/** router.back() 불가 시 fallback 경로로 이동 */
export function useGoBack(fallbackHref = "/") {
  const router = useRouter();

  return useCallback(() => {
    if (canNavigateBack()) {
      router.back();
      return;
    }
    router.push(fallbackHref);
  }, [router, fallbackHref]);
}
