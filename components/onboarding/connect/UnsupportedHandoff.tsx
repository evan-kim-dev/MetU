"use client";

import { useEffect, useState } from "react";

import { DevCurlFold } from "@/components/onboarding/connect/DevCurlFold";
import { StickyActionBar } from "@/components/onboarding/connect/StickyActionBar";
import { useClipboardCopy } from "@/components/onboarding/connect/useClipboardCopy";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

type Props = {
  reason: "desktop" | "ios-low";
  skipBusy: boolean;
  onSkip: () => void;
  onBackToDevice?: () => void;
};

export function UnsupportedHandoff({
  reason,
  skipBusy,
  onSkip,
  onBackToDevice,
}: Props) {
  const [origin, setOrigin] = useState("");
  const { copy, status, label } = useClipboardCopy();

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const url = origin ? `${origin}/onboarding/automation` : "";

  if (reason === "ios-low") {
    return (
      <div className="flex flex-col gap-4 pb-28">
        <h2 tabIndex={-1} className="text-xl font-extrabold text-ink-heading">
          이 방법은 iOS 27 이상에서 쓸 수 있어요
        </h2>
        <p className="text-sm leading-relaxed text-ink-body">
          iPhone을 업데이트한 뒤 다시 연결해 주세요. 지금은 건너뛰어도 괜찮아요.
        </p>
        <StickyActionBar>
          <button
            type="button"
            className="min-h-11 text-sm font-semibold text-ink-body underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            disabled={skipBusy}
            aria-busy={skipBusy}
            onClick={onSkip}
          >
            나중에 하기
          </button>
          {onBackToDevice ? (
            <button
              type="button"
              className="min-h-11 text-sm text-ink-body underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              onClick={onBackToDevice}
            >
              iOS 버전을 다시 선택
            </button>
          ) : null}
        </StickyActionBar>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-28">
      <h2 tabIndex={-1} className="text-xl font-extrabold text-ink-heading">
        휴대폰에서 이어서 설정해 주세요
      </h2>
      <p className="text-sm leading-relaxed text-ink-body">
        자동 기록은 카드 알림이 오는 휴대폰에서 설정해요. 휴대폰에서 아래 주소를
        열고 같은 계정으로 로그인해 주세요.
      </p>
      <div className="break-all rounded-xl bg-surface-soft p-3 font-mono text-sm text-ink-heading">
        {url || "주소를 준비하는 중…"}
      </div>
      <PrimaryButton
        type="button"
        disabled={!url}
        onClick={() => void copy(url)}
      >
        {label ?? "주소 복사"}
      </PrimaryButton>
      {status === "copied" ? (
        <p role="status" className="text-sm text-ink-body">
          복사했어요 ✓
        </p>
      ) : null}
      <p className="text-sm leading-relaxed text-ink-body">
        휴대폰이 iPhone이면 Safari에서 열어 주세요. 홈 화면 앱은 로그인이 따로
        저장돼 다시 로그인해야 해요.
      </p>
      <DevCurlFold />
      <StickyActionBar>
        <button
          type="button"
          className="min-h-11 text-sm font-semibold text-ink-body underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          disabled={skipBusy}
          aria-busy={skipBusy}
          onClick={onSkip}
        >
          나중에 하기
        </button>
      </StickyActionBar>
    </div>
  );
}
