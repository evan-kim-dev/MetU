"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

const DISMISS_KEY = "metu-pwa-install-dismissed-at";
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

/**
 * Android/Chrome: native install prompt via beforeinstallprompt.
 * iOS Safari: guide to Share ? Add to Home Screen.
 */
export function InstallBanner() {
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<"android" | "ios" | null>(null);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null
  );

  useEffect(() => {
    if (isStandaloneDisplay()) return;
    if (wasDismissedRecently()) return;

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
  }, []);

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
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-nav-offset">
      <div className="pointer-events-auto w-full max-w-mobile animate-fade-up rounded-2xl border border-brand/20 bg-surface-white/95 p-3.5 shadow-soft backdrop-blur-md">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <Download className="h-5 w-5" strokeWidth={2.2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold text-ink-heading">
              MetU? ? ??? ??
            </p>
            {mode === "ios" ? (
              <p className="mt-1 text-xs leading-5 text-ink-body">
                ??{" "}
                <Share className="inline h-3.5 w-3.5 align-text-bottom text-brand" />{" "}
                ?? ? <span className="font-bold">? ??? ??</span>?
                ?????.
              </p>
            ) : (
              <p className="mt-1 text-xs leading-5 text-ink-body">
                ??? ?? ??, ?? ?? ??? ? ??? ?????.
              </p>
            )}
            <div className="mt-3 flex items-center gap-2">
              {mode === "android" ? (
                <button
                  type="button"
                  onClick={() => void handleInstall()}
                  className="rounded-xl bg-brand px-3.5 py-2 text-xs font-bold text-white active:scale-98"
                >
                  ????
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleClose}
                className="rounded-xl border border-line-soft bg-white px-3.5 py-2 text-xs font-bold text-ink-body"
              >
                ???
              </button>
            </div>
          </div>
          <button
            type="button"
            aria-label="??"
            onClick={handleClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-caption active:bg-surface-soft"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
