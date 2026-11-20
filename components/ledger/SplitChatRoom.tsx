"use client";

import { Bot, Paperclip, Send, X, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ds/Button";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  type SplitAttachmentPayload,
  type SplitChatMessage,
  type SplitPreviewPayload,
} from "@/lib/ledger/split-chat";
import { uploadSplitChatAttachment } from "@/lib/ledger/split-chat-attachments";
import { subscribeSplitChatMessages } from "@/lib/ledger/split-chat-client";
import type { TripMember } from "@/lib/ledger/types";
import { formatKRW } from "@/lib/shared/format";
import { getBrowserSupabase } from "@/lib/supabase/browser";

export type SplitChatMember = {
  id: string;
  displayName: string;
  userId?: string | null;
};

type Props = {
  tripId: string;
  /** 여행 멤버 — 헤더·말풍선 아바타에 표시 */
  members?: readonly SplitChatMember[];
  /** overlay: 풀스크린 시트. inline: 정산 화면 안 카톡형 패널(기본). */
  variant?: "inline" | "overlay";
  open?: boolean;
  onClose?: () => void;
  /** 고급 분담(칩/배치) 경로 */
  onOpenAdvanced?: () => void;
};

type ListResponse = {
  ok?: boolean;
  threadId?: string;
  messages?: SplitChatMessage[];
  error?: string;
};

type SendResponse = {
  ok?: boolean;
  threadId?: string;
  userMessage?: SplitChatMessage | null;
  agentMessage?: SplitChatMessage | null;
  error?: string;
};

type ConfirmResponse = {
  ok?: boolean;
  already?: boolean;
  systemMessage?: SplitChatMessage | null;
  error?: string;
  message?: string;
};

const AVATAR_TONES = [
  "bg-mu-accent-soft text-mu-accent",
  "bg-mu-ok-soft text-mu-ok",
  "bg-mu-warn-soft text-mu-warn",
  "bg-mu-sunken text-mu-fg-2",
] as const;

function initialOf(name: string): string {
  const t = name.trim();
  if (!t) return "?";
  return t.slice(0, 1);
}

function toneFor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h + key.charCodeAt(i) * (i + 1)) % 97;
  return AVATAR_TONES[h % AVATAR_TONES.length]!;
}

function MemberAvatar({
  name,
  toneKey,
  bot,
  size = "md",
}: {
  name: string;
  toneKey: string;
  bot?: boolean;
  size?: "sm" | "md";
}) {
  const box = size === "sm" ? "h-8 w-8 text-mu-caption" : "h-9 w-9 text-mu-label";
  if (bot) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-full bg-mu-accent text-mu-on-accent ${box}`}
        aria-hidden
      >
        <Bot className={size === "sm" ? "h-4 w-4" : "h-5 w-5"} />
      </div>
    );
  }
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-bold ${box} ${toneFor(toneKey)}`}
      aria-hidden
    >
      {initialOf(name)}
    </div>
  );
}

function mergeMessages(
  prev: SplitChatMessage[],
  next: SplitChatMessage
): SplitChatMessage[] {
  if (prev.some((m) => m.id === next.id)) return prev;
  return [...prev, next].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt)
  );
}

function AttachmentBlock({
  payload,
  onAccent,
}: {
  payload: SplitAttachmentPayload;
  onAccent?: boolean;
}) {
  if (payload.kind === "image") {
    return (
      <a
        href={payload.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block overflow-hidden rounded-mu-md"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- 채팅 첨부 미리보기 */}
        <img
          src={payload.url}
          alt={payload.fileName}
          className="max-h-48 w-full object-cover"
        />
      </a>
    );
  }
  return (
    <a
      href={payload.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex min-h-tap items-center gap-2 break-all text-mu-caption font-semibold underline ${
        onAccent ? "text-mu-on-accent" : "text-mu-accent"
      }`}
    >
      <Paperclip className="h-4 w-4 shrink-0" aria-hidden />
      {payload.fileName}
    </a>
  );
}

function MessageBubbleContent({
  message,
  onAccent,
}: {
  message: SplitChatMessage;
  onAccent?: boolean;
}) {
  const attach =
    message.payload?.type === "attachment" ? message.payload : null;
  const showBody =
    !attach ||
    (message.body !== "사진" && message.body !== attach.fileName);

  return (
    <div className="flex flex-col gap-2">
      {attach ? <AttachmentBlock payload={attach} onAccent={onAccent} /> : null}
      {showBody || !attach ? (
        <p className="whitespace-pre-wrap">{message.body}</p>
      ) : null}
    </div>
  );
}

function PreviewCard({
  message,
  payload,
  isAnonymous,
  confirmingId,
  onConfirm,
  onDismiss,
}: {
  message: SplitChatMessage;
  payload: SplitPreviewPayload;
  isAnonymous: boolean;
  confirmingId: string | null;
  onConfirm: (message: SplitChatMessage, payload: SplitPreviewPayload) => void;
  onDismiss: (messageId: string) => void;
}) {
  const guestBlocked = isAnonymous && !payload.canGuestConfirm;
  const busy = confirmingId === message.id;

  return (
    <div
      data-testid="split-preview-card"
      className="mt-2 border-t border-mu-line pt-2"
    >
      <p className="text-mu-caption font-semibold text-mu-fg-2">
        {payload.label}
      </p>
      <ul className="mt-1.5 space-y-1">
        {payload.after.map((row) => {
          const before =
            payload.before.find((b) => b.memberId === row.memberId)?.krw ?? 0;
          const changed = before !== row.krw;
          return (
            <li
              key={row.memberId}
              className="flex items-center justify-between gap-2 text-mu-caption"
            >
              <span className="text-mu-fg">{row.name}</span>
              <span
                className={`mu-num font-bold ${
                  changed ? "text-mu-accent" : "text-mu-fg-3"
                }`}
              >
                {changed ? `${formatKRW(before)} → ` : ""}
                {formatKRW(row.krw)}
              </span>
            </li>
          );
        })}
      </ul>
      {guestBlocked ? (
        <p className="mt-2 text-mu-caption text-mu-warn">
          다른 사람 몫 변경은 호스트만 확인할 수 있어요.
        </p>
      ) : (
        <div className="mt-3 flex gap-2">
          <Button
            type="button"
            variant="primary"
            size="md"
            className="min-h-11 flex-1 rounded-full"
            loading={busy}
            disabled={busy}
            onClick={() => onConfirm(message, payload)}
          >
            적용
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="md"
            className="min-h-11 flex-1 rounded-full"
            disabled={busy}
            onClick={() => onDismiss(message.id)}
          >
            되돌리기
          </Button>
        </div>
      )}
    </div>
  );
}

function SystemBanner({ body }: { body: string }) {
  const looksLikeCard =
    body.includes("카드") || body.includes("승인") || body.includes("알림");
  return (
    <div
      className="mx-auto flex max-w-[94%] items-start gap-2 rounded-mu-lg border border-mu-line bg-mu-card px-3 py-2.5 text-left text-mu-caption text-mu-fg shadow-sm"
      role="status"
    >
      {looksLikeCard ? (
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-mu-warn-soft text-mu-warn">
          <Zap className="h-3 w-3" strokeWidth={2.5} aria-hidden />
        </span>
      ) : null}
      <p className="min-w-0 flex-1 leading-snug">{body}</p>
    </div>
  );
}

/**
 * 분담 실시간 대화방. MetU AI 미리보기 → 확인 시에만 서버 apply.
 */
export function SplitChatRoom({
  tripId,
  members = [],
  variant = "inline",
  open = true,
  onClose,
  onOpenAdvanced,
}: Props) {
  const { user, isAnonymous } = useAuth();
  const myId = user?.id ?? null;
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SplitChatMessage[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inline = variant === "inline";

  const memberByUserId = useMemo(() => {
    const map = new Map<string, SplitChatMember>();
    for (const m of members) {
      if (m.userId) map.set(m.userId, m);
    }
    return map;
  }, [members]);

  const headerNames = useMemo(() => {
    const names = members.map((m) => m.displayName.trim()).filter(Boolean);
    return [...names, "MetU"];
  }, [members]);

  const headerSubtitle = useMemo(() => {
    const n = headerNames.length;
    if (n <= 1) return "MetU AI";
    const shown = headerNames.slice(0, 3).join(", ");
    const more = n > 3 ? ` 외 ${n - 3}명` : "";
    return `${shown}${more} · ${n}명`;
  }, [headerNames]);

  const exampleName = useMemo(() => {
    const other = members.find((m) => m.userId !== myId);
    return other?.displayName.trim() || "민수";
  }, [members, myId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/trips/${tripId}/split-chat`, {
        credentials: "include",
      });
      const json = (await res.json()) as ListResponse;
      if (!res.ok || !json.ok || !json.threadId) {
        setError("대화방을 불러오지 못했어요.");
        return;
      }
      setThreadId(json.threadId);
      setMessages(json.messages ?? []);
    } catch {
      setError("대화방을 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  useEffect(() => {
    if (!open || !threadId) return;
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    const channel = subscribeSplitChatMessages(supabase, threadId, (msg) => {
      setMessages((prev) => mergeMessages(prev, msg));
    });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [open, threadId]);

  useEffect(() => {
    if (!open) return;
    bottomRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    if (!open || inline) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(t);
  }, [open, inline]);

  async function postChat(body: {
    text?: string;
    attachment?: { kind: "image" | "file"; url: string; fileName: string };
  }) {
    const res = await fetch(`/api/trips/${tripId}/split-chat`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as SendResponse;
    if (!res.ok || !json.ok) {
      throw new Error("send-failed");
    }
    if (json.threadId) setThreadId(json.threadId);
    if (json.userMessage) {
      setMessages((prev) => mergeMessages(prev, json.userMessage!));
    }
    if (json.agentMessage) {
      setMessages((prev) => mergeMessages(prev, json.agentMessage!));
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError("");
    setText("");
    try {
      await postChat({ text: trimmed });
    } catch {
      setError("메시지를 보내지 못했어요.");
      setText(trimmed);
    } finally {
      setSending(false);
    }
  }

  async function handleAttachSelected(file: File) {
    if (sending || !myId) return;
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setError("파일 전송은 로그인 연결이 필요해요.");
      return;
    }
    setSending(true);
    setError("");
    try {
      const uploaded = await uploadSplitChatAttachment(supabase, {
        tripId,
        userId: myId,
        file,
      });
      if ("error" in uploaded) {
        setError(uploaded.error);
        return;
      }
      const caption = text.trim();
      setText("");
      await postChat({
        text: caption || undefined,
        attachment: {
          kind: uploaded.kind,
          url: uploaded.url,
          fileName: uploaded.fileName,
        },
      });
    } catch {
      setError("파일을 보내지 못했어요.");
    } finally {
      setSending(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleConfirm(
    message: SplitChatMessage,
    payload: SplitPreviewPayload
  ) {
    setConfirmingId(message.id);
    setError("");
    try {
      const res = await fetch(`/api/trips/${tripId}/split-chat/confirm`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: message.id,
          beforeDigest: payload.beforeDigest,
          idempotencyKey: payload.idempotencyKey,
        }),
      });
      const json = (await res.json()) as ConfirmResponse;
      if (!res.ok || !json.ok) {
        setError(json.message ?? "반영하지 못했어요. 다시 시도해 주세요.");
        return;
      }
      setDismissed((prev) => new Set(prev).add(message.id));
      if (json.systemMessage) {
        setMessages((prev) => mergeMessages(prev, json.systemMessage!));
      }
    } catch {
      setError("반영하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setConfirmingId(null);
    }
  }

  function resolveSenderName(m: SplitChatMessage): string {
    if (m.senderKind === "agent") return "MetU";
    if (m.senderKind === "system") return "시스템";
    if (m.senderUserId) {
      const hit = memberByUserId.get(m.senderUserId);
      if (hit?.displayName) return hit.displayName;
    }
    return m.senderName || "여행자";
  }

  if (!open) return null;

  const stackMembers = members.slice(0, 3);

  const panel = (
    <div
      className={
        inline
          ? "flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden border-y border-mu-line bg-mu-sunken"
          : "relative z-10 flex h-[min(92dvh,720px)] w-full max-w-mobile flex-col overflow-hidden rounded-t-mu-xl border border-mu-line bg-mu-sunken shadow-mu-sheet sm:rounded-mu-xl"
      }
      data-testid="split-chat-room"
      role={inline ? "region" : "dialog"}
      aria-modal={inline ? undefined : true}
      aria-label="분담 대화방"
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-mu-line bg-mu-card px-3 py-2.5">
        <div
          className="relative h-9 shrink-0"
          style={{
            width: `${32 + Math.min(stackMembers.length, 3) * 14}px`,
          }}
          aria-hidden
        >
          {stackMembers.length === 0 ? (
            <MemberAvatar name="MetU" toneKey="metu" bot size="sm" />
          ) : (
            <>
              {stackMembers.map((m, i) => (
                <div
                  key={m.id}
                  className="absolute top-0"
                  style={{ left: `${i * 14}px`, zIndex: i + 1 }}
                >
                  <MemberAvatar
                    name={m.displayName}
                    toneKey={m.id}
                    size="sm"
                  />
                </div>
              ))}
              <div
                className="absolute top-0"
                style={{
                  left: `${Math.min(stackMembers.length, 3) * 14}px`,
                  zIndex: 8,
                }}
              >
                <MemberAvatar name="MetU" toneKey="metu" bot size="sm" />
              </div>
            </>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-mu-label font-bold text-mu-fg">
            분담 대화
          </p>
          <p
            className="truncate text-mu-caption text-mu-fg-3"
            data-testid="split-chat-members"
          >
            {headerSubtitle}
          </p>
        </div>
        {onOpenAdvanced ? (
          <button
            type="button"
            className="min-h-tap shrink-0 px-1 text-mu-caption font-semibold text-mu-fg-3"
            onClick={onOpenAdvanced}
          >
            고급
          </button>
        ) : null}
        {!inline && onClose ? (
          <button
            type="button"
            className="inline-flex min-h-tap min-w-tap items-center justify-center rounded-mu-md text-mu-fg-2"
            aria-label="대화방 닫기"
            onClick={onClose}
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        ) : null}
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-3">
        {!loading ? (
          <SystemBanner
            body={
              members.length > 0
                ? `${headerNames.slice(0, -1).join(", ") || "멤버"}와 MetU가 함께 있어요. 미리보기를 확인해야 반영돼요.`
                : "MetU와 분담을 맞춰 보세요. 미리보기를 확인해야 반영돼요."
            }
          />
        ) : null}

        {loading ? (
          <p className="text-center text-mu-caption text-mu-fg-3">
            불러오는 중…
          </p>
        ) : null}

        {!loading && messages.length === 0 ? (
          <div className="flex items-end gap-2">
            <MemberAvatar name="MetU" toneKey="metu" bot size="sm" />
            <div className="min-w-0 max-w-[82%]">
              <p className="mb-0.5 px-1 text-mu-caption font-medium text-mu-fg-2">
                MetU
              </p>
              <div className="rounded-2xl rounded-tl-sm bg-mu-card px-3.5 py-2.5 text-mu-body text-mu-fg shadow-sm">
                분담을 바꾸고 싶으면 말해 주세요.
                <br />
                예: 「{exampleName}는 이 건에서 빼줘」
              </div>
            </div>
          </div>
        ) : null}

        {messages.map((m) => {
          const mine = m.senderKind === "user" && m.senderUserId === myId;
          const isAgent = m.senderKind === "agent";
          const isSystem = m.senderKind === "system";
          const showPreview =
            isAgent &&
            m.payload?.type === "split_preview" &&
            !dismissed.has(m.id);
          const name = resolveSenderName(m);

          if (isSystem) {
            return <SystemBanner key={m.id} body={m.body} />;
          }

          if (mine) {
            return (
              <div key={m.id} className="flex flex-col items-end gap-1">
                <div className="max-w-[82%] rounded-2xl rounded-tr-sm bg-mu-accent px-3.5 py-2.5 text-mu-body text-mu-on-accent shadow-sm">
                  <MessageBubbleContent message={m} onAccent />
                </div>
              </div>
            );
          }

          return (
            <div key={m.id} className="flex items-end gap-2">
              <MemberAvatar
                name={name}
                toneKey={m.senderUserId ?? m.id}
                bot={isAgent}
                size="sm"
              />
              <div className="min-w-0 max-w-[82%]">
                <p className="mb-0.5 px-1 text-mu-caption font-medium text-mu-fg-2">
                  {name}
                </p>
                <div className="rounded-2xl rounded-tl-sm bg-mu-card px-3.5 py-2.5 text-mu-body text-mu-fg shadow-sm">
                  <MessageBubbleContent message={m} />
                  {showPreview && m.payload?.type === "split_preview" ? (
                    <PreviewCard
                      message={m}
                      payload={m.payload}
                      isAnonymous={Boolean(isAnonymous)}
                      confirmingId={confirmingId}
                      onConfirm={handleConfirm}
                      onDismiss={(id) =>
                        setDismissed((prev) => new Set(prev).add(id))
                      }
                    />
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {error ? (
        <p
          role="alert"
          className="shrink-0 bg-mu-card px-3 py-1 text-mu-caption text-mu-err"
        >
          {error}
        </p>
      ) : null}

      <form
        onSubmit={handleSend}
        className="flex shrink-0 items-center gap-2 border-t border-mu-line bg-mu-card px-3 py-2"
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,.doc,.docx,.xls,.xlsx,.zip,.txt"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleAttachSelected(file);
          }}
        />
        <button
          type="button"
          disabled={sending || !myId}
          className="inline-flex min-h-tap min-w-tap items-center justify-center rounded-full text-mu-fg-2 disabled:opacity-40"
          aria-label="사진·파일 첨부"
          onClick={() => fileRef.current?.click()}
        >
          <Paperclip className="h-5 w-5" aria-hidden />
        </button>
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={2000}
          placeholder={`${exampleName} 빼고…`}
          disabled={sending}
          className="min-h-tap flex-1 rounded-full border border-mu-line bg-mu-bg px-4 text-mu-body text-mu-fg outline-none focus:border-mu-accent"
          aria-label="분담 메시지"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="inline-flex min-h-tap min-w-tap items-center justify-center rounded-full bg-mu-accent text-mu-on-accent disabled:opacity-40"
          aria-label="보내기"
        >
          <Send className="h-5 w-5" aria-hidden />
        </button>
      </form>
    </div>
  );

  if (inline) return panel;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="닫기"
        tabIndex={-1}
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      {panel}
    </div>
  );
}

/** SettleStep 등에서 TripMember 그대로 넘길 때 */
export function toSplitChatMembers(
  members: readonly TripMember[]
): SplitChatMember[] {
  return members.map((m) => ({
    id: m.id,
    displayName: m.displayName,
    userId: m.userId ?? null,
  }));
}
