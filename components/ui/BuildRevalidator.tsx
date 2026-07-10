"use client";

import { useEffect } from "react";

const BUILD_TAG =
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ??
  process.env.NEXT_PUBLIC_BUILD_TAG ??
  "dev";

const STORAGE_KEY = "metu-app-build";

/**
 * 배포 버전이 바뀌면 브라우저에 남은 예전 JS 번들을 버리고 한 번 새로고침한다.
 */
export function BuildRevalidator() {
  useEffect(() => {
    const previous = localStorage.getItem(STORAGE_KEY);
    localStorage.setItem(STORAGE_KEY, BUILD_TAG);

    if (!previous || previous === BUILD_TAG || BUILD_TAG === "dev") {
      return;
    }

    if (sessionStorage.getItem("metu-build-reloaded") === BUILD_TAG) {
      return;
    }

    sessionStorage.setItem("metu-build-reloaded", BUILD_TAG);

    if ("caches" in window) {
      void caches.keys().then((keys) => {
        keys.forEach((key) => {
          void caches.delete(key);
        });
      });
    }

    window.location.reload();
  }, []);

  return null;
}
