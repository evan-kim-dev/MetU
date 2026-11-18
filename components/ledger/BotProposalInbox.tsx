"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { TABLES } from "@/lib/constants";
import { INBOX_NAME, LEDGER_STATUS } from "@/lib/ledger/inbox-copy";
import { getBrowserSupabase } from "@/lib/supabase/browser";

type Row = {
  id: string;
  kind: string;
  user_text: string;
  assistant_text: string;
  payload: { splitText?: string; scheduleHint?: string };
  status: string;
  created_at: string;
};

type Props = {
  tripId: string;
  isHost: boolean;
};

/**
 * 확인함 안의 MetU 봇 제안. 호스트 승인·거절. 승인 시 분담은 미리보기 링크로 이어가요.
 */
export function BotProposalInbox({ tripId, isHost }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const reload = useCallback(async () => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    const { data } = await supabase
      .from(TABLES.tripBotProposals)
      .select(
        "id, kind, user_text, assistant_text, payload, status, created_at"
      )
      .eq("trip_id", tripId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(20);
    setRows((data as Row[] | null) ?? []);
  }, [tripId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function decide(id: string, decision: "approved" | "rejected") {
    if (!isHost || busyId) return;
    setBusyId(id);
    setMsg("");
    try {
      const res = await fetch(
        `/api/trips/${tripId}/bot/proposals/${id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision }),
        }
      );
      if (!res.ok) {
        setMsg("처리에 실패했어요.");
        return;
      }
      setMsg(
        decision === "approved"
          ? "승인했어요. 분담이면 아래에서 미리보기로 이어 주세요."
          : "거절했어요. 장부는 그대로예요."
      );
      await reload();
    } finally {
      setBusyId(null);
    }
  }

  if (rows.length === 0) return null;

  return (
    <section
      aria-label="MetU 봇 제안"
      className="rounded-mu-xl border border-mu-line bg-mu-card p-4"
    >
      <div className="flex items-center gap-2">
        <h2 className="text-mu-heading text-mu-fg">MetU 봇 제안</h2>
        <span className="rounded-full bg-mu-warn-soft px-2 py-0.5 text-mu-caption font-bold text-mu-warn">
          {LEDGER_STATUS.needsReview}
        </span>
      </div>
      <p className="mt-1 text-mu-caption text-mu-fg-3">
        채팅 제안이에요. 승인해도 금액은 자동으로 바뀌지 않아요.
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {rows.map((r) => {
          const splitText =
            typeof r.payload?.splitText === "string"
              ? r.payload.splitText
              : r.user_text;
          return (
            <li
              key={r.id}
              className="rounded-mu-lg bg-mu-sunken px-3 py-3 text-mu-caption"
            >
              <p className="font-bold text-mu-fg">
                {r.kind === "split"
                  ? "분담"
                  : r.kind === "schedule"
                    ? "일정"
                    : "확인"}{" "}
                · {r.user_text}
              </p>
              <p className="mt-1 text-mu-fg-2">{r.assistant_text}</p>
              {isHost ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    className="mu-focus min-h-tap rounded-mu-md bg-mu-accent px-3 font-bold text-mu-on-accent disabled:opacity-40"
                    onClick={() => void decide(r.id, "approved")}
                  >
                    승인
                  </button>
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    className="mu-focus min-h-tap rounded-mu-md border border-mu-line px-3 font-bold text-mu-fg disabled:opacity-40"
                    onClick={() => void decide(r.id, "rejected")}
                  >
                    거절
                  </button>
                  {r.kind === "split" ? (
                    <Link
                      href={`/trips/${tripId}/ledger?step=adjust`}
                      className="mu-focus inline-flex min-h-tap items-center font-bold text-mu-accent"
                    >
                      분담 미리보기 ({splitText.slice(0, 24)})
                    </Link>
                  ) : null}
                </div>
              ) : (
                <p className="mt-2 text-mu-fg-3">
                  호스트가 {INBOX_NAME}에서 확인해요.
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {msg ? (
        <p role="status" className="mt-2 text-mu-caption font-semibold text-mu-ok">
          {msg}
        </p>
      ) : null}
    </section>
  );
}
