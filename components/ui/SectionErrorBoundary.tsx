"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
}

/** 섹션 단위 클라이언트 에러 격리 (라우트 error.tsx 보완) */
export class SectionErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[SectionErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-line-soft bg-surface-white px-4 py-8 text-center shadow-sm">
          <p className="text-sm font-extrabold text-ink-heading">
            {this.props.fallbackTitle ?? "이 영역을 불러오지 못했어요"}
          </p>
          <p className="text-xs leading-relaxed text-ink-caption">
            {this.props.fallbackMessage ??
              "잠시 후 다시 시도해 주세요. 다른 기능은 계속 사용할 수 있어요."}
          </p>
          <PrimaryButton
            onClick={() => this.setState({ hasError: false })}
            className="mt-1"
          >
            다시 시도
          </PrimaryButton>
        </div>
      );
    }

    return this.props.children;
  }
}
