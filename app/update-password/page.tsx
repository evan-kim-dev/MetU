"use client";

import Link from "next/link";
import { UpdatePasswordForm } from "@/components/auth/UpdatePasswordForm";

export default function UpdatePasswordPage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-y-auto overscroll-contain bg-mu-bg">
      <div className="relative z-10 mx-auto flex w-full max-w-mobile flex-1 flex-col justify-center gap-4 px-4 py-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
        <header className="text-center">
          <p className="text-mu-heading font-bold text-mu-fg">비밀번호 재설정</p>
          <p className="mt-1 text-mu-caption text-mu-fg-2">
            새 비밀번호를 저장하면 바로 이용할 수 있어요.
          </p>
        </header>

        <UpdatePasswordForm
          onUpdated={() => {
            window.location.replace("/");
          }}
        />

        <p className="text-center text-xs text-mu-fg-2">
          <Link href="/login" className="underline underline-offset-2">
            로그인으로 돌아가기
          </Link>
        </p>
      </div>
    </div>
  );
}
