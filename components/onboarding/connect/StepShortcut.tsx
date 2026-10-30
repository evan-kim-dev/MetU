"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { StickyActionBar } from "@/components/onboarding/connect/StickyActionBar";
import { useClipboardCopy } from "@/components/onboarding/connect/useClipboardCopy";
import { ShortcutGuide } from "@/components/onboarding/guide/ShortcutGuide";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { IOS_SHORTCUT_ICLOUD_URL } from "@/lib/onboarding/constants";

type Props = {
  token: string | null;
  copied: boolean;
  needsToken: boolean;
  onOpenShortcut: () => void;
  onCopyResult: (ok: boolean) => void;
  onConfirmAdded: () => void;
  onReissueRequest: () => void;
};

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export function StepShortcut({
  token,
  copied,
  needsToken,
  onOpenShortcut,
  onCopyResult,
  onConfirmAdded,
  onReissueRequest,
}: Props) {
  const { copy, label } = useClipboardCopy();
  const [returned, setReturned] = useState(false);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") setReturned(true);
    };
    const onPage = () => setReturned(true);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pageshow", onPage);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pageshow", onPage);
    };
  }, []);

  const openShortcut = async () => {
    if (!token) return;
    onOpenShortcut();
    const copyPromise = navigator.clipboard
      .writeText(token)
      .then(() => true)
      .catch(() => false);
    const ok = await Promise.race([copyPromise, sleep(400).then(() => false)]);
    onCopyResult(Boolean(ok));
    window.location.assign(IOS_SHORTCUT_ICLOUD_URL);
  };

  if (needsToken && !token) {
    return (
      <div className="flex flex-col gap-4 pb-28">
        <h2 tabIndex={-1} className="text-xl font-extrabold text-ink-heading">
          단축어 추가
        </h2>
        <div className="rounded-2xl border border-line-muted bg-surface-soft p-4">
          <p className="text-sm leading-relaxed text-ink-body">
            연결 코드는 보안상 다시 보여 드릴 수 없어요. 이미 단축어에 넣었다면
            그대로 쓰면 돼요. 새로 넣어야 하면 다시 만들어 주세요.
          </p>
        </div>
        <StickyActionBar>
          <PrimaryButton type="button" onClick={onReissueRequest}>
            연결 코드 다시 만들기
          </PrimaryButton>
        </StickyActionBar>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-28">
      <h2 tabIndex={-1} className="text-xl font-extrabold text-ink-heading">
        단축어 추가
      </h2>

      {returned ? (
        <p role="status" className="rounded-xl bg-surface-soft p-3 text-sm text-ink-body">
          {copied
            ? "단축어를 추가하셨나요? 질문에 연결 코드를 붙여넣어야 해요."
            : "연결 코드를 복사하지 못했어요. 아래 '연결 코드 복사'를 누른 뒤 단축어를 다시 열어 붙여넣어 주세요."}
          {!copied && token ? (
            <button
              type="button"
              className="ml-2 min-h-11 font-semibold text-brand underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              onClick={() => void copy(token).then(onCopyResult)}
            >
              {label ?? "연결 코드 복사"}
            </button>
          ) : null}
        </p>
      ) : null}

      <ShortcutGuide
        variant="embedded"
        defaultPlatform="ios"
        onlyStepIds={["ios-a1", "ios-a2", "ios-a3"]}
        features={{ revokeOnReissue: true }}
        defaultCollapsed={false}
      />

      <StickyActionBar>
        <PrimaryButton type="button" onClick={() => void openShortcut()}>
          iPhone 자동화 추가
        </PrimaryButton>
        <PrimaryButton type="button" variant="secondary" onClick={onConfirmAdded}>
          단축어를 추가했어요
        </PrimaryButton>
        <button
          type="button"
          className="min-h-11 text-sm text-ink-body underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          onClick={() => void openShortcut()}
        >
          다시 열기
        </button>
        <Link
          href="/onboarding/shortcut-guide?platform=ios&faq=ios-faq-12"
          className="inline-flex min-h-11 items-center text-sm text-ink-body underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          막혔어요
        </Link>
      </StickyActionBar>
    </div>
  );
}
