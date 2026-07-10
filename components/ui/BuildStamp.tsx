"use client";

import { useEffect } from "react";

const BUILD_TAG = process.env.NEXT_PUBLIC_BUILD_TAG ?? "";

/** Tiny deploy marker so we can tell which build the browser is actually running. */
export function BuildStamp() {
  useEffect(() => {
    if (!BUILD_TAG) return;
    document.documentElement.dataset.build = BUILD_TAG.slice(0, 8);
  }, []);

  if (!BUILD_TAG) return null;

  return (
    <span
      className="pointer-events-none fixed bottom-[4.75rem] right-2 z-50 rounded bg-ink-heading/70 px-1.5 py-0.5 font-mono text-[9px] text-white opacity-70"
      title="배포 빌드"
    >
      {BUILD_TAG.slice(0, 8)}
    </span>
  );
}
