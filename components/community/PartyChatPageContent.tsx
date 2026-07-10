"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
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
import { getBrowserSupabase } from "@/lib/supabase/browser";

interface PartyChatPageContentProps {
  postId: string;
  listHref: "/opod" | "/board";
}

export function PartyChatPageContent({
  postId,
  listHref,
}: PartyChatPageContentProps) {
  const router = useRouter();
  const { user, provider } = useAuth();
  const { profile } = useProfile();
  const { getPost, isPartyHost, isPartyJoined } = useCommunity();
  const post = getPost(postId);
  const [messages, setMessages] = useState<PartyChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  const isPartyPost = Boolean(post && post.category === "party" && post.party);
  const canChat = useMemo(() => {
    if (!post || !isPartyPost) return false;
    return isPartyHost(post) || isPartyJoined(post);
  }, [isPartyHost, isPartyJoined, isPartyPost, post]);

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

  async function handleSend() {
    const text = draft.trim();
    if (!text || !post || !user?.id || sending) return;

    setSending(true);
    setDraft("");

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
        setSending(false);
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
            동행 참여 후 채팅방에 입장할 수 있어요.
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
                  className={`flex items-end gap-1.5 ${mine ? "justify-end" : "justify-start"}`}
                >
                  {mine ? (
                    <>
                      <p className="shrink-0 pb-1 text-[10px] text-ink-caption">
                        {timeLabel}
                      </p>
                      <div className="max-w-[80%] rounded-2xl bg-brand px-3.5 py-2.5 text-surface-white">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">
                          {message.message}
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="flex max-w-[80%] flex-col gap-1">
                      <p className="text-[11px] font-bold text-ink-caption">
                        {message.senderName}
                      </p>
                      <div className="flex items-end gap-1.5">
                        <div className="rounded-2xl bg-surface-soft px-3.5 py-2.5 text-ink-body">
                          <p className="whitespace-pre-wrap text-sm leading-relaxed">
                            {message.message}
                          </p>
                        </div>
                        <p className="shrink-0 pb-1 text-[10px] text-ink-caption">
                          {timeLabel}
                        </p>
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
          <div className="flex items-stretch gap-2">
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
