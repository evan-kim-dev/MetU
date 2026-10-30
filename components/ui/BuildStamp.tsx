"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const BUILD_TAG = process.env.NEXT_PUBLIC_BUILD_TAG ?? "";
const SHOW_KEY = "metu.showBuild";

function BuildStampInner() {
  const searchParams = useSearchParams();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (BUILD_TAG) {
      document.documentElement.dataset.build = BUILD_TAG.slice(0, 8);
    }

    const flag = searchParams?.get("build");
    if (flag === "1") {
      try {
        localStorage.setItem(SHOW_KEY, "1");
      } catch {
        /* ignore */
      }
    } else if (flag === "0") {
      try {
        localStorage.removeItem(SHOW_KEY);
      } catch {
        /* ignore */
      }
    }

    const fromStorage =
      typeof window !== "undefined" &&
      (() => {
        try {
          return localStorage.getItem(SHOW_KEY) === "1";
        } catch {
          return false;
        }
      })();

    setShow(process.env.NODE_ENV !== "production" || fromStorage);
  }, [searchParams]);

  if (!BUILD_TAG || !show) return null;

  return (
    <span
      className="pointer-events-none fixed bottom-[4.75rem] right-2 z-50 rounded bg-ink-heading/70 px-1.5 py-0.5 font-mono text-[9px] text-white opacity-70"
      title="배포 빌드"
    >
      {BUILD_TAG.slice(0, 8)}
    </span>
  );
}

/** Tiny deploy marker; visible badge only in non-prod or ?build=1. */
export function BuildStamp() {
  return (
    <Suspense fallback={null}>
      <BuildStampInner />
    </Suspense>
  );
}
