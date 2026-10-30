"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { safeNextPath } from "@/lib/security/safe-next";

export function SessionExpiredDialog() {
  const { provider } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const lastOpenAt = useRef(0);
  const titleId = useId();
  const descId = useId();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (provider === "guest") return;

    const onExpired = () => {
      const now = Date.now();
      if (now - lastOpenAt.current < 5000) return;
      lastOpenAt.current = now;
      setOpen(true);
    };

    window.addEventListener("metu:session-expired", onExpired);
    return () => window.removeEventListener("metu:session-expired", onExpired);
  }, [provider]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  if (provider === "guest") return null;

  const next = safeNextPath(
    `${pathname}${searchParams?.toString() ? `?${searchParams}` : ""}`,
    pathname || "/"
  );
  const loginHref = `/login?next=${encodeURIComponent(next)}`;

  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={descId}
      className="fixed left-1/2 top-1/2 z-[60] w-[min(100%-2rem,22rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line-soft bg-surface-white p-5 shadow-soft backdrop:bg-ink-heading/40"
      onClose={() => setOpen(false)}
      onCancel={(e) => {
        e.preventDefault();
        setOpen(false);
      }}
    >
      <h2 id={titleId} className="text-base font-extrabold text-ink-heading">
        로그인이 만료됐어요
      </h2>
      <p id={descId} className="mt-2 text-sm leading-6 text-ink-body">
        계속하려면 다시 로그인해 주세요. 작성 중이던 내용은 이 화면에 그대로 남아
        있어요.
      </p>
      <div className="mt-4 flex flex-col gap-2">
        <a
          href={loginHref}
          className="inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-brand px-4 text-sm font-bold text-white"
        >
          다시 로그인
        </a>
        <button
          type="button"
          className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-line-soft px-4 text-sm font-bold text-ink-body"
          onClick={() => setOpen(false)}
        >
          닫기
        </button>
      </div>
    </dialog>
  );
}
