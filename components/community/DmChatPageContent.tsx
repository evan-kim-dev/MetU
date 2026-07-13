"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Send } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useFriends } from "@/lib/friends/FriendsProvider";
import { useProfile } from "@/lib/profile/ProfileProvider";
import { markDmChatSeen } from "@/lib/community/chat-notice";
import { formatRelativeTime } from "@/lib/community/storage";
import {
  dmMessagePreview,
  formatDmChatAttachmentMessage,
  parseDmChatAttachment,
  uploadDmChatAttachment,
} from "@/lib/dm/dm-attachments";
import {
  fetchDmMessages,
  getOrCreateDmThread,
  notifyDmMessage,
  sendDmMessage,
  subscribeDmMessages,
  type DmMessage,
} from "@/lib/dm/dm-supabase";
import { getBrowserSupabase } from "@/lib/supabase/browser";

interface DmChatPageContentProps {
  peerId: string;
}

function ChatMessageBody({ message, mine }: { message: string; mine: boolean }) {
  const attachment = parseDmChatAttachment(message);

  if (attachment?.type === "image") {
    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block overflow-hidden rounded-xl"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={attachment.url}
          alt="첨부 이미지"
          className="max-h-56 max-w-full object-cover"
        />
      </a>
    );
  }

  if (attachment?.type === "file") {
    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        className={[
          "inline-flex items-center gap-1 text-sm underline underline-offset-2",
          mine ? "text-surface-white" : "text-brand",
        ].join(" ")}
      >
        <span aria-hidden>📎</span>
        <span className="break-all">{attachment.name}</span>
      </a>
    );
  }

  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed">{message}</p>
  );
}

function ChatSenderAvatar({ src, name }: { src: string; name: string }) {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line-soft bg-surface-soft">
      <SafeAvatar
        src={src}
        alt={`${name} 프로필`}
        fallback="💬"
        textClassName="text-lg leading-none"
      />
    </div>
  );
}

export function DmChatPageContent({ peerId }: DmChatPageContentProps) {
  const router = useRouter();
  const { user, provider } = useAuth();
  const { profile } = useProfile();
  const { isFriend, friends, isReady: friendsReady } = useFriends();
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [attachError, setAttachError] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const me = user?.id ?? null;
  const isGuest = provider === "guest";
  const peer = useMemo(
    () => friends.find((friend) => friend.id === peerId),
    [friends, peerId]
  );
  const peerName = peer?.name ?? "친구";
  const peerAvatar = peer?.avatar ?? "👤";
  const canChat = Boolean(me && !isGuest && friendsReady && isFriend(peerId));

  const displayMessages = useMemo(
    () =>
      messages.map((message) => {
        if (message.senderName !== "여행자") return message;
        if (message.senderId === me) {
          return {
            ...message,
            senderName: profile.name || "나",
            senderAvatar: profile.avatarUrl || message.senderAvatar,
          };
        }
        if (message.senderId === peerId) {
          return {
            ...message,
            senderName: peerName,
            senderAvatar: peerAvatar,
          };
        }
        return message;
      }),
    [me, messages, peerAvatar, peerId, peerName, profile.avatarUrl, profile.name]
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [displayMessages]);

  useEffect(() => {
    if (!me || isGuest || !friendsReady) {
      setLoading(false);
      return;
    }
    if (!isFriend(peerId)) {
      setLoading(false);
      setError("친구가 된 상대와만 1:1 채팅할 수 있어요.");
      return;
    }

    const supabase = getBrowserSupabase();
    if (!supabase) {
      setLoading(false);
      setError("Supabase 연결이 필요해요.");
      return;
    }

    let mounted = true;
    setLoading(true);
    setError("");

    async function boot() {
      const thread = await getOrCreateDmThread(supabase!, me!, peerId);
      if (!mounted) return;
      if (!thread) {
        setError("채팅방을 만들지 못했어요. 친구 상태를 확인해 주세요.");
        setLoading(false);
        return;
      }

      setThreadId(thread.id);
      const remote = await fetchDmMessages(supabase!, thread.id);
      if (!mounted) return;
      setMessages(remote);
      setLoading(false);
      markDmChatSeen(thread.id);
    }

    void boot();

    return () => {
      mounted = false;
    };
  }, [friendsReady, isFriend, isGuest, me, peerId]);

  useEffect(() => {
    if (!threadId) return;
    const supabase = getBrowserSupabase();
    if (!supabase) return;

    const channel = subscribeDmMessages(supabase, threadId, (message) => {
      setMessages((prev) => {
        if (prev.some((item) => item.id === message.id)) return prev;
        return [...prev, message];
      });
    });

    return () => {
      markDmChatSeen(threadId);
      void supabase.removeChannel(channel);
    };
  }, [threadId]);

  useEffect(() => {
    if (!threadId) return;
    markDmChatSeen(threadId);
  }, [displayMessages, threadId]);

  async function deliverMessage(text: string) {
    if (!me || !threadId) return false;
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setError("Supabase 연결이 필요해요.");
      return false;
    }

    const sent = await sendDmMessage(supabase, {
      threadId,
      senderId: me,
      senderName: profile.name,
      senderAvatar: profile.avatarUrl || "💬",
      message: text,
    });

    if (!sent) {
      setError("메시지를 보내지 못했어요. 잠시 후 다시 시도해 주세요.");
      return false;
    }

    setMessages((prev) => {
      if (prev.some((message) => message.id === sent.id)) return prev;
      return [...prev, sent];
    });

    void notifyDmMessage(supabase, {
      recipientId: peerId,
      actorId: me,
      actorName: profile.name || "친구",
      threadId,
      preview: dmMessagePreview(text),
    });

    return true;
  }

  async function handleSend() {
    const text = draft.trim();
    if (!text || sending || !threadId) return;

    setSending(true);
    setDraft("");
    setError("");
    setAttachError("");
    const ok = await deliverMessage(text);
    if (!ok) setDraft(text);
    setSending(false);
  }

  async function handleAttachSelected(file: File) {
    if (!me || !threadId || sending) return;
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setAttachError("파일 전송은 Supabase 연결이 필요해요.");
      return;
    }

    setSending(true);
    setAttachError("");
    setError("");

    const uploaded = await uploadDmChatAttachment(supabase, {
      threadId,
      userId: me,
      file,
    });

    if ("error" in uploaded) {
      setAttachError(uploaded.error);
      setSending(false);
      return;
    }

    const message = formatDmChatAttachmentMessage({
      type: uploaded.type,
      url: uploaded.url,
      fileName: uploaded.fileName,
    });
    const ok = await deliverMessage(message);
    if (!ok) setAttachError("첨부는 올렸지만 메시지 전송에 실패했어요.");
    setSending(false);
  }

  if (isGuest || !me) {
    return (
      <MobileShell title="1:1 채팅" showBack backHref="/opod">
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
          <p className="text-center text-sm text-ink-body">
            1:1 채팅은 로그인 후 이용할 수 있어요.
          </p>
          <PrimaryButton
            className="h-11 min-h-tap rounded-xl bg-brand text-sm"
            onClick={() =>
              router.push(`/login?next=${encodeURIComponent(`/opod/dm/${peerId}`)}`)
            }
          >
            로그인하기
          </PrimaryButton>
        </div>
      </MobileShell>
    );
  }

  if (!canChat && !loading) {
    return (
      <MobileShell title="1:1 채팅" showBack backHref="/opod" showBottomNav={false}>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6">
          <p className="text-center text-sm text-ink-body">
            {error || "친구가 된 상대와만 1:1 채팅할 수 있어요."}
          </p>
          <PrimaryButton
            className="h-11 min-h-tap rounded-xl bg-brand text-sm"
            onClick={() => router.push("/opod")}
          >
            멧톡으로 돌아가기
          </PrimaryButton>
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell
      title={peerName}
      showBack
      backHref="/opod"
      showBottomNav={false}
      rightSlot={
        <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-line-soft bg-surface-soft">
          <SafeAvatar src={peerAvatar} alt={peerName} />
        </div>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
          {loading ? (
            <p className="text-center text-xs text-ink-caption">불러오는 중…</p>
          ) : displayMessages.length === 0 ? (
            <p className="text-center text-xs leading-relaxed text-ink-caption">
              아직 대화가 없어요. 먼저 인사해 보세요.
            </p>
          ) : (
            displayMessages.map((message) => {
              const mine = message.senderId === me;
              return (
                <div
                  key={message.id}
                  className={[
                    "flex max-w-[88%] gap-2",
                    mine ? "ml-auto flex-row-reverse" : "mr-auto",
                  ].join(" ")}
                >
                  {!mine ? (
                    <ChatSenderAvatar
                      src={message.senderAvatar}
                      name={message.senderName}
                    />
                  ) : null}
                  <div
                    className={[
                      "rounded-2xl px-3.5 py-2.5",
                      mine
                        ? "rounded-br-md bg-brand text-surface-white"
                        : "rounded-bl-md bg-surface-soft text-ink-body",
                    ].join(" ")}
                  >
                    {!mine ? (
                      <p className="mb-1 text-2xs font-bold text-ink-caption">
                        {message.senderName}
                      </p>
                    ) : null}
                    <ChatMessageBody message={message.message} mine={mine} />
                    <p
                      className={[
                        "mt-1 text-[10px]",
                        mine ? "text-surface-white/70" : "text-ink-caption",
                      ].join(" ")}
                    >
                      {formatRelativeTime(message.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={endRef} />
        </div>

        <div className="border-t border-line-soft bg-surface-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          {attachError ? (
            <p className="mb-2 text-xs text-danger">{attachError}</p>
          ) : null}
          {error ? (
            <p className="mb-2 text-xs font-medium text-danger">{error}</p>
          ) : null}
          <div className="flex items-stretch gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.txt"
              className="hidden"
              disabled={sending || !threadId}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void handleAttachSelected(file);
              }}
            />
            <button
              type="button"
              aria-label="사진 또는 파일 첨부"
              disabled={sending || !threadId}
              onClick={() => fileInputRef.current?.click()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl2 border border-line-soft bg-surface-soft text-ink-body active:bg-surface-base disabled:opacity-50"
            >
              <Plus className="h-5 w-5" strokeWidth={2.4} />
            </button>
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={sending || !threadId}
              maxLength={1000}
              placeholder="메시지 입력…"
              className="min-w-0 flex-1 rounded-xl2 border border-line-soft bg-surface-base px-3.5 py-2.5 text-sm text-ink-heading outline-none placeholder:text-ink-caption focus:border-brand/40 disabled:opacity-60"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
            />
            <button
              type="button"
              disabled={sending || !threadId || !draft.trim()}
              aria-label="전송"
              onClick={() => void handleSend()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl2 bg-brand text-surface-white active:brightness-95 disabled:opacity-50"
            >
              <Send className="h-4 w-4" strokeWidth={2.4} />
            </button>
          </div>
        </div>
      </div>
    </MobileShell>
  );
}
