"use client";

import { Suspense } from "react";

import { ConnectFlow } from "@/components/onboarding/connect/ConnectFlow";
import { MobileShell } from "@/components/layout/MobileShell";

function ConnectFallback() {
  return (
    <div className="space-y-3 p-1" aria-busy="true">
      <p className="text-sm text-ink-body">기기를 확인하는 중…</p>
      <div className="h-4 animate-pulse rounded bg-surface-soft" />
      <div className="h-4 animate-pulse rounded bg-surface-soft" />
      <div className="h-4 animate-pulse rounded bg-surface-soft" />
    </div>
  );
}

export default function AutomationOnboardingPage() {
  return (
    <MobileShell>
      <div className="flex flex-col gap-4 px-5 pb-2 pt-5">
        <Suspense fallback={<ConnectFallback />}>
          <ConnectFlow />
        </Suspense>
      </div>
    </MobileShell>
  );
}
