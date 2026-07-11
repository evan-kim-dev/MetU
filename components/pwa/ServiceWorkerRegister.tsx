"use client";

import { useEffect } from "react";

/**
 * Registers the MetU service worker.
 * Enabled in production builds, and on localhost for local PWA testing.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const host = window.location.hostname;
    const isLocal =
      host === "localhost" || host === "127.0.0.1" || host === "[::1]";
    if (process.env.NODE_ENV !== "production" && !isLocal) return;

    const build = process.env.NEXT_PUBLIC_BUILD_TAG?.slice(0, 8) ?? "dev";
    const swUrl = `/sw.js?v=${encodeURIComponent(build)}`;

    void navigator.serviceWorker
      .register(swUrl, { scope: "/" })
      .then((registration) => {
        registration.update().catch(() => undefined);

        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (
              worker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              worker.postMessage("SKIP_WAITING");
            }
          });
        });
      })
      .catch(() => undefined);
  }, []);

  return null;
}
