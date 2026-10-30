"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, Share, X } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";

const DISMISS_KEY = "metu-pwa-install-dismissed-at";
const VISIT_KEY = "metu.visit.count";
const DISMISS_DAYS = 14;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandaloneDisplay() {
  if (typeof window === "undefined") return true;
  const mq = window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone =
    "standalone" in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return mq || iosStandalone;
}

function isIosSafari() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isWebkit = /WebKit/.test(ua);
  const isChromeOrCriOS = /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return isIOS && isWebkit && !isChromeOrCriOS;
}

function wasDismissedRecently() {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function dismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

function bumpVisitCount(): number {
  try {
    const next = Number(localStorage.getItem(VISIT_KEY) ?? "0") + 1;
    localStorage.setItem(VISIT_KEY, String(next));
    return next;
  } catch {
    return 1;
  }
}

function pathBlocksBanner(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname.startsWith("/auth") ||
    pathname === "/onboarding" ||
    pathname.startsWith("/onboarding/") ||
    pathname.startsWith("/legal") ||
    pathname.startsWith("/join") ||
    pathname.startsWith("/s/") ||
    pathname.startsWith("/trips/share/")
  );
}

function pathAllowsBanner(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname.startsWith("/trips") ||
    pathname.startsWith("/agent") ||
    pathname.startsWith("/profile")
  );
}

/**
 * Android/Chrome: native install prompt via beforeinstallprompt.
 * iOS Safari: guide to Share → Add to Home Screen.
 * Hidden on login/onboarding and until logged-in visit count ≥ 2.
 */
export function InstallBanner() {
  const pathname = usePathname() ?? "/";
  const { user, provider } = useAuth();
  const [visible, setVisible] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mode, setMode] = useState<"android" | "ios" | null>(null);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null
  );
  const [visits, setVisits] = useState(0);

  const isLoggedIn = Boolean(user) && provider !== "guest";

  useEffect(() => {
    if (!isLoggedIn) return;
    setVisits(bumpVisitCount());
  }, [isLoggedIn]);

  useEffect(() => {
    if (isStandaloneDisplay()) return;
    if (wasDismissedRecently()) return;
    if (!isLoggedIn) return;
    if (pathBlocksBanner(pathname)) return;
    if (!pathAllowsBanner(pathname)) return;
    if (visits < 2) return;

    if (isIosSafari()) {
      setMode("ios");
      setVisible(true);
      return;
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setMode("android");
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    };
  }, [isLoggedIn, pathname, visits]);

  if (!visible || !mode) return null;

  async function handleInstall() {
    if (mode === "android" && deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") {
        setVisible(false);
        setDeferred(null);
      }
    }
  }

  function handleClose() {
    dismiss();
    setVisible(false);
    setSheetOpen(false);
  }

  const hasBottomNav =
    pathname === "/" ||
    pathname.startsWith("/trips") ||
    pathname.startsWith("/agent") ||
    pathname.startsWith("/profile");

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-3"
      style={{
        bottom: hasBottomNav
          ? "calc(env(safe-area-inset-bottom) + 4.75rem)"
          : "calc(env(safe-area-inset-bottom) + 1rem)",
      }}
    >
      <div className="pointer-events-auto flex max-h-14 w-full max-w-mobile items-center gap-2 rounded-2xl border border-brand/20 bg-surface-white/95 px-3 py-2 shadow-soft backdrop-blur-md">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <Download className="h-4 w-4" strokeWidth={2.2} />
        </span>
        <p className="min-w-0 flex-1 truncate text-sm font-bold text-ink-heading">
          {mode === "ios"
            ? "홈 화면에 추가하면 앱처럼 열려요"
            : "MetU를 앱으로 설치할 수 있어요"}
        </p>
        {mode === "android" ? (
          <button
            type="button"
            onClick={() => void handleInstall()}
            className="shrink-0 rounded-xl bg-brand px-3 py-2 text-xs font-bold text-white"
          >
            설치
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="shrink-0 rounded-xl border border-line-soft px-3 py-2 text-xs font-bold text-ink-body"
          >
            설치 방법
          </button>
        )}
        {mode === "android" ? (
          <button
            type="button"
            onClick={handleClose}
            className="shrink-0 rounded-xl px-2 py-2 text-xs font-bold text-ink-body"
          >
            나중에
          </button>
        ) : null}
        <button
          type="button"
          aria-label="닫기"
          onClick={handleClose}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-caption active:bg-surface-soft"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {sheetOpen && mode === "ios" ? (
        <div className="pointer-events-auto absolute inset-x-3 bottom-16 rounded-2xl border border-line-soft bg-surface-white p-4 shadow-soft">
          <p className="text-sm font-extrabold text-ink-heading">
            홈 화면에 추가하면 앱처럼 열려요
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm leading-6 text-ink-body">
            <li>
              아래 공유 버튼(
              <Share className="inline h-3.5 w-3.5 align-text-bottom text-brand" />
              )을 눌러요
            </li>
            <li>&apos;홈 화면에 추가&apos;를 눌러요</li>
            <li>오른쪽 위 &apos;추가&apos;를 눌러요</li>
          </ol>
          <p className="mt-2 text-xs leading-5 text-ink-muted">
            홈 화면 앱은 Safari와 로그인이 따로라서, 처음 열 때 한 번 더 로그인해야 할 수
            있어요.
          </p>
          <button
            type="button"
            className="mt-3 min-h-[44px] w-full rounded-xl border border-line-soft text-sm font-bold"
            onClick={() => setSheetOpen(false)}
          >
            닫기
          </button>
        </div>
      ) : null}
    </div>
  );
}
