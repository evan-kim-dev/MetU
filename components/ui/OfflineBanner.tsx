"use client";

import { useEffect, useState } from "react";
import { useOnlineStatus } from "@/lib/hooks/useOnlineStatus";

export function OfflineBanner() {
  const online = useOnlineStatus();
  const [wasOffline, setWasOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    if (!online) {
      setWasOffline(true);
      setShowReconnected(false);
      return;
    }
    if (wasOffline) {
      setShowReconnected(true);
      const t = window.setTimeout(() => {
        setShowReconnected(false);
        setWasOffline(false);
      }, 2000);
      return () => window.clearTimeout(t);
    }
  }, [online, wasOffline]);

  if (!online) {
    return (
      <div
        role="status"
        className="fixed inset-x-0 top-0 z-50 bg-ink-heading px-4 py-2 text-center text-sm text-white"
        style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
      >
        오프라인이에요. 연결되면 자동으로 다시 시도해요.
      </div>
    );
  }

  if (showReconnected) {
    return (
      <div
        role="status"
        className="fixed inset-x-0 top-0 z-50 bg-emerald-700 px-4 py-2 text-center text-sm text-white"
        style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
      >
        다시 연결됐어요
      </div>
    );
  }

  return null;
}
