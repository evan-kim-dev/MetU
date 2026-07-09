import { Suspense } from "react";
import { LoginContent } from "@/components/auth/LoginContent";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-surface-base">
          <div className="h-8 w-8 animate-pulse rounded-full bg-brand/20" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
