"use client";

import { useEffect } from "react";

const BUILD_TAG = process.env.NEXT_PUBLIC_BUILD_TAG ?? "";
const STORAGE_KEY = "metu-build-tag";

/**
 * 배포 커밋이 바뀌었는데 브라우저/PWA가 예전 JS를 붙잡고 있을 때
 * 한 번만 하드 리로드한다. (빈 태그·동일 태그는 무시 → 무한 새로고침 방지)
 */
export function BuildRevalidator() {
  useEffect(() => {
    if (!BUILD_TAG || BUILD_TAG.length < 7) return;

    let previous: string | null = null;
    try {
      previous = localStorage.getItem(STORAGE_KEY);
    } catch {
      return;
    }

    if (previous === BUILD_TAG) return;

    try {
      localStorage.setItem(STORAGE_KEY, BUILD_TAG);
    } catch {
      return;
    }

    // 첫 방문은 저장만 하고 끝
    if (!previous) return;

    const reloadKey = `metu-reloaded:${BUILD_TAG}`;
    try {
      if (sessionStorage.getItem(reloadKey)) return;
      sessionStorage.setItem(reloadKey, "1");
    } catch {
      return;
    }

    if ("caches" in window) {
      void caches.keys().then((keys) => {
        for (const key of keys) void caches.delete(key);
      });
    }

    const url = new URL(window.location.href);
    url.searchParams.set("_b", BUILD_TAG.slice(0, 8));
    window.location.replace(url.toString());
  }, []);

  return null;
}
