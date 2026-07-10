"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Send } from "lucide-react";
import { MobileShell } from "@/components/layout/MobileShell";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useCommunity } from "@/lib/community/CommunityProvider";
import {
  fetchPartyChatMessages,
  sendPartyChatMessage,
  subscribePartyChatMessages,
  type PartyChatMessage,
} from "@/lib/community/chat-supabase";
import {
  appendLocalPartyChatMessage,
  createLocalPartyChatMessage,
  loadLocalPartyChatMessages,
  mergePartyChatMessages,
} from "@/lib/community/chat-storage";
import { markChatSeen } from "@/lib/community/chat-notice";
import { formatRelativeTime } from "@/lib/community/storage";
import { useProfile } from "@/lib/profile/ProfileProvider";
import {
  formatPartyChatAttachmentMessage,
  parsePartyChatAttachment,
  uploadPartyChatAttachment,
} from "@/lib/community/chat-attachments";
import { getBrowserSupabase } from "@/lib/supabase/browser";

interface PartyChatPageContentProps {
  postId: string;
  listHref: "/opod" | "/board";
}

function isAvatarImage(src: string): boolean {
  return (
    src.startsWith("http://") ||
    src.startsWith("https://") ||
    src.startsWith("data:")
  );
}

function ChatMessageBody({ message }: { message: string }) {
  const attachment = parsePartyChatAttachment(message);

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
        className="inline-flex items-center gap-1 text-sm underline underline-offset-2"
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
  const avatar = src.trim() || "💬";

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line-soft bg-surface-soft">
      {isAvatarImage(avatar) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatar}
          alt={`${name} 프로필`}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="text-lg leading-none">{avatar}</span>
      )}
    </div>
  );
}

export function PartyChatPageContent({
  postId,
  listHref,
}: PartyChatPageContentProps) {
  const router = useRouter();
  const { user, provider } = useAuth();
  const { profile } = useProfile();
  const { getPost, isPartyHost, isPartyJoined, isPartyPending } = useCommunity();
  const post = getPost(postId);
  const [messages, setMessages] = useState<PartyChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [attachError, setAttachError] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isPartyPost = Boolean(post && post.category === "party" && post.party);
  const canChat = useMemo(() => {
    if (!post || !isPartyPost) return false;
    return isPartyHost(post) || isPartyJoined(post);
  }, [isPartyHost, isPartyJoined, isPartyPost, post]);
  const isPending = Boolean(post && isPartyPost && isPartyPending(post));

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => {
    if (!post || !isPartyPost || !canChat) {
      setLoading(false);
      return;
    }

    const currentPostId = post.id;
    const supabaseClient = getBrowserSupabase();
    let mounted = true;

    async function load() {
      const remote = supabaseClient
        ? await fetchPartyChatMessages(supabaseClient, currentPostId)
        : [];
      const local = loadLocalPartyChatMessages(currentPostId);
      if (mounted) {
        setMessages(mergePartyChatMessages(remote, local));
        setLoading(false);
        markChatSeen(currentPostId);
      }
    }

    void load();

    if (!supabaseClient) {
      return () => {
        mounted = false;
        markChatSeen(currentPostId);
      };
    }

    const sb: NonNullable<typeof supabaseClient> = supabaseClient;
    const channel = subscribePartyChatMessages(sb, currentPostId, (message) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
    });

    return () => {
      mounted = false;
      markChatSeen(currentPostId);
      void sb.removeChannel(channel);
    };
  }, [canChat, isPartyPost, post]);

  useEffect(() => {
    if (!post?.id || !canChat) return;
    markChatSeen(post.id);
  }, [canChat, messages, post?.id]);

  async function sendMessage(text: string) {
    if (!text || !post || !user?.id) return;

    const supabase = getBrowserSupabase();
    if (supabase) {
      const sent = await sendPartyChatMessage(supabase, {
        postId: post.id,
        senderId: user.id,
        senderName: profile.name,
        senderAvatar: profile.avatarUrl || "💬",
        message: text,
      });

      if (sent) {
        setMessages((prev) => {
          if (prev.some((message) => message.id === sent.id)) return prev;
          return [...prev, sent];
        });
        return;
      }
    }

    const localMessage = createLocalPartyChatMessage({
      postId: post.id,
      senderId: user.id,
      senderName: profile.name,
      senderAvatar: profile.avatarUrl || "💬",
      message: text,
    });
    appendLocalPartyChatMessage(localMessage);
    setMessages((prev) => [...prev, localMessage]);
  }

  async function handleSend() {
    const text = draft.trim();
    if (!text || sending) return;

    setSending(true);
    setDraft("");
    setAttachError("");
    await sendMessage(text);
    setSending(false);
  }

  async function handleAttachSelected(file: File) {
    if (!post || !user?.id || sending) return;

    const supabase = getBrowserSupabase();
    if (!supabase) {
      setAttachError("파일 전송은 Supabase 연결이 필요해요.");
      return;
    }

    setSending(true);
    setAttachError("");

    const uploaded = await uploadPartyChatAttachment(supabase, {
      postId: post.id,
      userId: user.id,
      file,
    });

    if ("error" in uploaded) {
      setAttachError(uploaded.error);
      setSending(false);
      return;
    }

    await sendMessage(
      formatPartyChatAttachmentMessage({
        type: uploaded.type,
        url: uploaded.url,
        fileName: uploaded.fileName,
      })
    );
    setSending(false);
  }

  if (!post || !isPartyPost) {
    return (
      <MobileShell title="동행 채팅" showBack backHref={listHref}>
        <div className="flex flex-col items-center gap-4 px-5 py-20 text-center">
          <p className="text-base font-bold text-ink-heading">
            동행 모집 글에서만 채팅을 사용할 수 있어요.
          </p>
          <PrimaryButton fullWidth={false} className="px-6" onClick={() => router.push(listHref)}>
            목록으로 돌아가기
          </PrimaryButton>
        </div>
      </MobileShell>
    );
  }

  if (!user || provider === "guest") {
    return (
      <MobileShell title="동행 채팅" showBack backHref={listHref}>
        <div className="flex flex-col items-center gap-4 px-5 py-20 text-center">
          <p className="text-base font-bold text-ink-heading">
            채팅은 로그인한 동행 멤버만 사용할 수 있어요.
          </p>
          <PrimaryButton fullWidth={false} className="px-6" onClick={() => router.push("/login")}>
            로그인하러 가기
          </PrimaryButton>
        </div>
      </MobileShell>
    );
  }

  if (!canChat) {
    return (
      <MobileShell title="동행 채팅" showBack backHref={listHref}>
        <div className="flex flex-col items-center gap-4 px-5 py-20 text-center">
          <p className="text-base font-bold text-ink-heading">
            {isPending
              ? "호스트 승인 후 채팅방에 입장할 수 있어요."
              : "동행 참여가 수락된 뒤에 채팅방에 입장할 수 있어요."}
          </p>
          <PrimaryButton fullWidth={false} className="px-6" onClick={() => router.push(`${listHref}/${post.id}`)}>
            동행 글로 이동
          </PrimaryButton>
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell title={post.title} showBack backHref={listHref} showBottomNav={false}>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {loading ? (
            <p className="py-10 text-center text-sm text-ink-caption">채팅 불러오는 중...</p>
          ) : messages.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-caption">첫 메시지를 남겨보세요.</p>
          ) : (
            messages.map((message) => {
              const mine = message.senderId === user.id;
              const timeLabel = formatRelativeTime(message.createdAt);
              return (
                <div
                  key={message.id}
                  className={`flex gap-1.5 ${mine ? "items-end justify-end" : "items-start justify-start"}`}
                >
                  {mine ? (
                    <>
                      <p className="shrink-0 pb-1 text-[10px] text-ink-caption">
                        {timeLabel}
                      </p>
                      <div className="max-w-[80%] rounded-2xl bg-brand px-3.5 py-2.5 text-surface-white">
                        <ChatMessageBody message={message.message} />
                      </div>
                    </>
                  ) : (
                    <div className="flex max-w-[85%] items-start gap-2">
                      <ChatSenderAvatar
                        src={message.senderAvatar}
                        name={message.senderName}
                      />
                      <div className="flex min-w-0 flex-col items-start gap-1">
                        <p className="text-[11px] font-bold text-ink-caption">
                          {message.senderName}
                        </p>
                        <div className="flex items-end gap-1.5">
                          <div className="rounded-2xl bg-surface-soft px-3.5 py-2.5 text-ink-body">
                            <ChatMessageBody message={message.message} />
                          </div>
                          <p className="shrink-0 pb-1 text-[10px] text-ink-caption">
                            {timeLabel}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={endRef} />
        </div>

        <div className="border-t border-line-soft bg-surface-white px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
          {attachError ? (
            <p className="mb-2 text-xs text-red-500">{attachError}</p>
          ) : null}
          <div className="flex items-stretch gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.txt"
              className="hidden"
              disabled={sending}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) {
                  void handleAttachSelected(file);
                }
              }}
            />
            <button
              type="button"
              aria-label="사진 또는 파일 첨부"
              disabled={sending}
              onClick={() => fileInputRef.current?.click()}
              className="flex min-h-[40px] w-10 shrink-0 items-center justify-center self-stretch rounded-xl border border-line-soft bg-surface-soft text-ink-body transition-all hover:bg-surface-base active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-5 w-5" />
            </button>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={1}
              placeholder="메시지를 입력하세요"
              disabled={sending}
              className="min-h-[40px] max-h-28 min-w-0 flex-1 resize-none rounded-xl border border-line-soft px-3 py-2 text-sm leading-5 text-ink-body outline-none focus:border-brand"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
            />
            <button
              type="button"
              aria-label="메시지 전송"
              disabled={!draft.trim() || sending}
              onClick={() => {
                void handleSend();
              }}
              className="flex min-h-[40px] w-10 shrink-0 items-center justify-center self-stretch rounded-xl bg-brand text-surface-white shadow-soft transition-all hover:brightness-105 active:brightness-95 disabled:cursor-not-allowed disabled:bg-line-muted disabled:text-surface-white/80 disabled:shadow-none"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </MobileShell>
  );
}
