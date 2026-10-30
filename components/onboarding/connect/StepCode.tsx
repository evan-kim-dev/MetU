"use client";

import { DevCurlFold } from "@/components/onboarding/connect/DevCurlFold";
import { StickyActionBar } from "@/components/onboarding/connect/StickyActionBar";
import { TokenReissueDialog } from "@/components/onboarding/connect/TokenReissueDialog";
import { useClipboardCopy } from "@/components/onboarding/connect/useClipboardCopy";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import type { DetectedPlatform } from "@/lib/onboarding/automation";

type Props = {
  platform: DetectedPlatform;
  token: string | null;
  copied: boolean;
  needsToken: boolean;
  issuing: boolean;
  reissueOpen: boolean;
  toast: string | null;
  onIssue: () => void;
  onCopyResult: (ok: boolean) => void;
  onNext: () => void;
  onReissueRequest: () => void;
  onReissueConfirm: () => void;
  onReissueCancel: () => void;
};

export function StepCode({
  platform,
  token,
  copied,
  needsToken,
  issuing,
  reissueOpen,
  toast,
  onIssue,
  onCopyResult,
  onNext,
  onReissueRequest,
  onReissueConfirm,
  onReissueCancel,
}: Props) {
  const { copy, label } = useClipboardCopy();

  const handleCopy = async () => {
    if (!token) return;
    const ok = await copy(token);
    onCopyResult(ok);
  };

  const nextLabel =
    platform === "android" ? "다음: 매크로 만들기" : "다음: 단축어 추가";

  return (
    <div className="flex flex-col gap-4 pb-28">
      <h2 tabIndex={-1} className="text-xl font-extrabold text-ink-heading">
        연결 코드 만들기
      </h2>
      <p className="text-sm leading-relaxed text-ink-body">
        연결 코드는 내 폰이 MetU에 알림을 보낼 때 쓰는 비밀번호 같은 거예요.
        만들면 자동으로 복사돼요. 이 화면을 벗어나면 다시 볼 수 없어요.
      </p>

      {needsToken && !token ? (
        <div className="rounded-2xl border border-line-muted bg-surface-soft p-4">
          <p className="text-sm leading-relaxed text-ink-body">
            연결 코드는 보안상 다시 보여 드릴 수 없어요. 이미 단축어에 넣었다면
            그대로 쓰면 돼요. 새로 넣어야 하면 다시 만들어 주세요.
          </p>
          <button
            type="button"
            className="mt-3 min-h-11 text-sm font-semibold text-brand underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            onClick={onReissueRequest}
          >
            연결 코드 다시 만들기
          </button>
        </div>
      ) : null}

      {token ? (
        <>
          <div
            aria-label="연결 코드"
            className="select-all break-all rounded-xl bg-surface-soft p-3 font-mono text-sm text-ink-heading"
          >
            {token}
          </div>
          <PrimaryButton type="button" onClick={() => void handleCopy()}>
            {label ?? "연결 코드 복사"}
          </PrimaryButton>
          <p role="status" className="text-sm text-ink-body">
            {copied
              ? "연결 코드를 복사했어요 ✓"
              : "자동 복사가 막혔어요. '연결 코드 복사'를 눌러 주세요."}
          </p>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-ink-heading">
            이 코드는 지금만 보여요. 다음 단계에서 붙여넣어야 하니 지우지
            마세요.
          </div>
          <button
            type="button"
            className="min-h-11 self-start text-sm font-semibold text-ink-body underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            onClick={onReissueRequest}
          >
            연결 코드 다시 만들기
          </button>
        </>
      ) : !needsToken ? (
        <PrimaryButton
          type="button"
          loading={issuing}
          disabled={issuing}
          onClick={onIssue}
        >
          {issuing ? "만드는 중…" : "연결 코드 만들기"}
        </PrimaryButton>
      ) : null}

      {toast ? (
        <p role="status" className="text-sm font-semibold text-ink-heading">
          {toast}
        </p>
      ) : null}

      <div className="border-t border-line-muted pt-4">
        <DevCurlFold />
      </div>

      <StickyActionBar>
        <PrimaryButton
          type="button"
          disabled={!token}
          aria-describedby={!token ? "code-next-hint" : undefined}
          onClick={onNext}
        >
          {nextLabel}
        </PrimaryButton>
        {!token ? (
          <p id="code-next-hint" className="text-xs text-ink-body">
            먼저 연결 코드를 만들어 주세요
          </p>
        ) : null}
      </StickyActionBar>

      <TokenReissueDialog
        open={reissueOpen}
        busy={issuing}
        onConfirm={onReissueConfirm}
        onCancel={onReissueCancel}
      />
    </div>
  );
}
