"use client";

import { MessageCircle } from "lucide-react";
import { EmptyState } from "@/components/ds/EmptyState";

type Props = {
  onBack: () => void;
};

/**
 * K14 제안 경로가 없으면 칩을 가짜로 연결하지 않고 안내만.
 */
export function GuestAdjust({ onBack }: Props) {
  return (
    <div className="flex flex-col gap-4 px-4 py-6">
      <EmptyState
        icon={MessageCircle}
        title="호스트에게 직접 말해 주세요"
        body="지금은 앱에서 분담 제안을 보낼 수 없어요. 채팅이나 말로 알려 주세요."
        action={
          <button
            type="button"
            className="mu-focus min-h-[44px] text-mu-label text-mu-accent"
            onClick={onBack}
          >
            내 몫으로
          </button>
        }
      />
    </div>
  );
}
