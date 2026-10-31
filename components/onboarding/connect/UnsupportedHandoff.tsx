"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { DevCurlFold } from "@/components/onboarding/connect/DevCurlFold";
import { StickyActionBar } from "@/components/onboarding/connect/StickyActionBar";
import { useClipboardCopy } from "@/components/onboarding/connect/useClipboardCopy";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import {
  handoffUrl,
  renderQrSvg,
  svgToDataUri,
} from "@/lib/onboarding/qr-svg";

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

  const url = origin ? handoffUrl(origin) : "";
  const [qrSrc, setQrSrc] = useState<string | null>(null);

  // 데스크톱에서만, 주소(토큰 없음)를 QR 로. 실패해도 주소·복사 버튼은 그대로 보여요.
  useEffect(() => {
    if (reason !== "desktop" || !url) return;
    let cancelled = false;
    void renderQrSvg(url)
      .then((svg) => {
        if (!cancelled) setQrSrc(svg ? svgToDataUri(svg) : null);
      })
      .catch((err: unknown) => {
        console.warn("[handoff] QR 생성에 실패했어요", err);
        if (!cancelled) setQrSrc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [reason, url]);

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
        자동 기록은 카드 알림이 오는 휴대폰에서 설정해요. 휴대폰 카메라로 QR을
        찍어 같은 계정으로 로그인해 주세요. iPhone은 Safari에서 열고, 홈 화면
        앱은 로그인이 따로라 거기서도 한 번 더 로그인해야 해요.
      </p>
      {qrSrc ? (
        <div className="flex justify-center">
          {/* data URI(SVG) — 외부 이미지 서비스를 쓰지 않아요 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrSrc}
            alt="휴대폰으로 열기 QR"
            width={192}
            height={192}
            className="h-48 w-48 rounded-xl border border-line-muted bg-white p-1"
          />
        </div>
      ) : null}
      <p className="text-sm leading-relaxed text-ink-body">
        QR을 쓸 수 없다면 아래 주소를 휴대폰에서 직접 열어 주세요.
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
        <Link
          href="/"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-ink-body underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          그냥 둘러보기
        </Link>
      </StickyActionBar>
    </div>
  );
}
