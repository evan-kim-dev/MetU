"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ds/Button";
import { Sheet } from "@/components/ds/Sheet";
import { INBOX_NAME } from "@/lib/ledger/inbox-copy";

type Msg = { role: "user" | "assistant"; text: string };

type Props = {
  tripId: string;
  open: boolean;
  onClose: () => void;
};

/**
 * 여행 부가 MetU 봇 채팅. 제안은 확인함 대기 — 메시지가 곧 지출이 되지 않아요.
 */
export function TripBotSheet({ tripId, open, onClose }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "assistant",
      text: `분담·일정 조정을 말해 주세요. 제안은 ${INBOX_NAME}에 들어가고, 호스트가 확인한 뒤에만 반영돼요.`,
    },
  ]);

  if (!open) return null;

  async function send() {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setMsgs((m) => [...m, { role: "user", text: trimmed }]);
    setText("");
    try {
      const res = await fetch(`/api/trips/${tripId}/bot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      const data = (await res.json()) as {
        reply?: string;
        proposalId?: string | null;
      };
      const reply =
        data.reply ??
        "응답을 받지 못했어요. 잠시 후 다시 시도해 주세요.";
      const suffix = data.proposalId
        ? `\n\n${INBOX_NAME}에 제안을 넣어 두었어요.`
        : "";
      setMsgs((m) => [...m, { role: "assistant", text: reply + suffix }]);
    } catch {
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          text: "네트워크 오류예요. 연결을 확인해 주세요.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title="MetU 봇">
      <div className="flex max-h-[55dvh] flex-col gap-3">
        <ul className="flex flex-1 flex-col gap-2 overflow-y-auto">
          {msgs.map((m, i) => (
            <li
              key={`${m.role}-${i}`}
              className={`rounded-mu-lg px-3 py-2 text-mu-caption ${
                m.role === "user"
                  ? "self-end bg-mu-accent-soft font-semibold text-mu-fg"
                  : "self-start bg-mu-sunken text-mu-fg-2"
              }`}
            >
              {m.text}
            </li>
          ))}
        </ul>
        <label className="sr-only" htmlFor="trip-bot-input">
          메시지
        </label>
        <textarea
          id="trip-bot-input"
          value={text}
          maxLength={500}
          disabled={busy}
          placeholder="예: 민수 맥주 빼줘"
          className="min-h-[72px] w-full rounded-mu-md border border-mu-line bg-mu-sunken px-3 py-2 text-mu-body"
          onChange={(e) => setText(e.target.value)}
        />
        <Button disabled={busy || !text.trim()} onClick={() => void send()}>
          {busy ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              생각 중…
            </span>
          ) : (
            "보내기"
          )}
        </Button>
      </div>
    </Sheet>
  );
}
