"use client";

import Link from "next/link";
import { useState } from "react";
import type {
  SettlementHistoryItem,
  SettlementStatus,
} from "@/lib/ledger/supabase";

function statusLabel(status: SettlementStatus): string {
  if (status === "completed") return "정산 완료";
  if (status === "superseded") return "최신 아님";
  if (status === "stale") return "지출 바뀜";
  return "진행 중";
}

function dateLabel(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "날짜 미상";
}

interface SettlementHistoryProps {
  items: SettlementHistoryItem[];
  /** 지금 화면에 보이는 정산 id. 목록에서는 뺀다. */
  currentId: string | null;
  origin: string;
}

/**
 * 이전 정산 버전과 각 버전의 공유 링크(/s/<토큰>).
 * 이미 보낸 링크를 다시 찾아 보낼 수 있게 해요. 이전 버전 링크는 "최신이 아니에요" 안내가 떠요.
 */
export function SettlementHistory({
  items,
  currentId,
  origin,
}: SettlementHistoryProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const previous = items.filter((it) => it.id !== currentId && it.shareToken);
  if (previous.length === 0) return null;

  async function copy(item: SettlementHistoryItem) {
    if (!item.shareToken) return;
    setError("");
    try {
      await navigator.clipboard.writeText(`${origin}/s/${item.shareToken}`);
      setCopiedId(item.id);
      window.setTimeout(
        () => setCopiedId((id) => (id === item.id ? null : id)),
        2000
      );
    } catch {
      setError("링크를 복사하지 못했어요. 열어서 주소를 복사해 주세요.");
    }
  }

  return (
    <section
      aria-label="이전 정산"
      className="flex flex-col gap-2 rounded-xl bg-surface-soft p-3 text-xs"
    >
      <p className="font-bold">이전 정산</p>
      <ul className="flex flex-col gap-2">
        {previous.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-white px-3 py-1"
          >
            <span>
              v{item.version} · {statusLabel(item.status)} ·{" "}
              {dateLabel(item.createdAt)}
            </span>
            <span className="flex items-center gap-1">
              <button
                type="button"
                aria-label={`v${item.version} 공유 링크 복사`}
                className="min-h-[44px] px-2 font-bold text-brand"
                onClick={() => void copy(item)}
              >
                {copiedId === item.id ? "복사했어요 ✓" : "링크 복사"}
              </button>
              <Link
                href={`/s/${item.shareToken}`}
                aria-label={`v${item.version} 정산 열기`}
                className="flex min-h-[44px] items-center px-2 font-bold text-brand"
              >
                열기
              </Link>
            </span>
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </section>
  );
}
