"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type ChatMsg = { id: string; role: "buddy" | "user"; text: string };

type EasterEggContextValue = {
  showToast: (message: string) => void;
  summonBuddy: (greeting?: string) => void;
};

const EasterEggContext = createContext<EasterEggContextValue | null>(null);

const TOAST_MS = 2500;

const QUICK_CHIPS = [
  { id: "chat", label: "뭐 도와줄 수 있어?" },
  { id: "budget", label: "예산 조언" },
  { id: "idea", label: "아이디어 좀" },
  { id: "metu", label: "Met U?" },
] as const;

function pickReply(pool: string[]): string {
  return pool[Math.floor(Math.random() * pool.length)] ?? pool[0];
}

function BuddyTypingBubble() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="버디가 답변 생성 중"
      className="self-start animate-fade-up"
    >
      <div className="flex items-end gap-2">
        <div className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-brand/20 bg-surface-white shadow-sm">
          <BuddyAvatar className="h-5 w-5" />
        </div>
        <div className="relative min-w-[7.5rem] rounded-2xl rounded-bl-md bg-surface-soft px-3.5 py-2.5">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl rounded-bl-md"
          >
            <span className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-brand/12 to-transparent motion-safe:animate-shimmer" />
          </span>
          <div className="relative flex flex-col gap-1.5">
            <div className="flex h-6 items-end gap-1.5 pb-0.5" aria-hidden>
              <i className="buddy-typing-dot" />
              <i className="buddy-typing-dot" />
              <i className="buddy-typing-dot" />
            </div>
            <span className="text-[11px] font-semibold tracking-wide text-ink-caption animate-buddy-think">
              생각 중…
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function BuddyAvatar({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden fill="none">
      <rect x="10" y="22" width="44" height="32" rx="10" className="fill-brand" />
      <rect
        x="18"
        y="14"
        width="28"
        height="12"
        rx="4"
        className="fill-brand-strong"
      />
      <circle cx="24" cy="36" r="4" className="fill-surface-white" />
      <circle cx="40" cy="36" r="4" className="fill-surface-white" />
      <circle cx="24" cy="36" r="1.8" className="fill-ink-heading" />
      <circle cx="40" cy="36" r="1.8" className="fill-ink-heading" />
      <path
        d="M26 46c2.5 3 9.5 3 12 0"
        className="stroke-surface-white"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M32 14V8"
        className="stroke-brand-strong"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="32" cy="6" r="3" className="fill-amber-300" />
    </svg>
  );
}

function OverlayLayer({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

export function EasterEggToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<string | null>(null);
  const [buddyVisible, setBuddyVisible] = useState(false);
  const [bubble, setBubble] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const toastTimer = useRef<number | null>(null);
  const bubbleTimer = useRef<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const messagesRef = useRef<ChatMsg[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const showToast = useCallback((next: string) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast(next);
    toastTimer.current = window.setTimeout(() => {
      setToast(null);
      toastTimer.current = null;
    }, TOAST_MS);
  }, []);

  const summonBuddy = useCallback((greeting?: string) => {
    const line =
      greeting ??
      pickReply([
        "어 나야. MetU 버디. 뭐든지 말해봐.",
        "숨은 메뉴 찾았네. 심심하면 말 걸든가.",
        "왔어? 태도 따라 나도 바뀜. 알아서 해.",
      ]);
    setBuddyVisible(true);
    setBubble(line);
    if (bubbleTimer.current) window.clearTimeout(bubbleTimer.current);
    bubbleTimer.current = window.setTimeout(() => {
      setBubble(null);
      bubbleTimer.current = null;
    }, 4500);
  }, []);

  const dismissBuddy = useCallback(() => {
    setBuddyVisible(false);
    setChatOpen(false);
    setBubble(null);
    setDraft("");
    setSending(false);
    setMessages([]);
  }, []);

  const openChat = useCallback(() => {
    setChatOpen(true);
    setBubble(null);
    setMessages((prev) =>
      prev.length > 0
        ? prev
        : [
            {
              id: "hello",
              role: "buddy",
              text: "나 MetU 버디. 뭐든 물어봐.",
            },
          ]
    );
  }, []);

  const pushBuddy = useCallback((text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: `b-${Date.now()}`, role: "buddy", text },
    ]);
  }, []);

  const sendUser = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;

      const userMsg: ChatMsg = {
        id: `u-${Date.now()}`,
        role: "user",
        text: trimmed,
      };
      const historyForApi = [...messagesRef.current, userMsg].map((m) => ({
        role: m.role,
        text: m.text,
      }));

      setMessages((prev) => [...prev, userMsg]);
      setSending(true);

      const buddyId = `b-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: buddyId, role: "buddy", text: "" },
      ]);

      try {
        const res = await fetch("/api/buddy-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            history: historyForApi.slice(0, -1),
          }),
        });
        if (!res.ok) throw new Error(`buddy-failed:${res.status}`);

        const { collectStreamedContent } = await import("@/lib/ai/stream-chat");
        const result = await collectStreamedContent(res, (token) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === buddyId ? { ...m, text: m.text + token } : m
            )
          );
        });
        const reply = result?.content?.trim();
        if (!reply) throw new Error("empty-reply");
        setMessages((prev) =>
          prev.map((m) => (m.id === buddyId ? { ...m, text: reply } : m))
        );
      } catch {
        // 배포에서 OpenRouter/BACKEND 미연결이면 여기로 떨어짐 (가드레일 아님)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === buddyId
              ? {
                  ...m,
                  text: "지금 AI랑 연결이 안 됐어. 잠시 후 다시 말 걸어봐.",
                }
              : m
          )
        );
      } finally {
        setSending(false);
      }
    },
    [sending]
  );

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
      if (bubbleTimer.current) window.clearTimeout(bubbleTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!chatOpen) return;
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatOpen]);

  const value = useMemo(
    () => ({ showToast, summonBuddy }),
    [showToast, summonBuddy]
  );

  return (
    <EasterEggContext.Provider value={value}>
      {children}

      <OverlayLayer>
        {toast ? (
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[80] flex justify-center px-4"
          >
            <p className="w-full max-w-mobile rounded-2xl border border-line-soft bg-ink-heading/90 px-4 py-2.5 text-center text-sm font-semibold text-surface-white shadow-soft">
              {toast}
            </p>
          </div>
        ) : null}

        {buddyVisible ? (
          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex justify-center">
            <div className="relative w-full max-w-mobile">
              <div className="absolute bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-3 flex max-w-[min(100%,18rem)] flex-col items-end gap-2">
                {bubble ? (
                  <div
                    role="status"
                    className="animate-fade-up rounded-2xl rounded-br-md border border-line-soft bg-surface-white px-3.5 py-2.5 text-xs font-semibold leading-relaxed text-ink-heading shadow-soft"
                  >
                    {bubble}
                  </div>
                ) : null}
                <div className="pointer-events-auto relative">
                  <button
                    type="button"
                    onClick={openChat}
                    aria-label="MetU 버디와 대화하기"
                    className="relative flex h-16 w-16 items-center justify-center rounded-full border-2 border-brand/30 bg-surface-white shadow-glow transition-transform active:scale-95 animate-buddy-pop"
                  >
                    <BuddyAvatar className="h-12 w-12 motion-safe:animate-float-soft" />
                  </button>
                  <button
                    type="button"
                    onClick={dismissBuddy}
                    aria-label="버디 닫기"
                    className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border border-line-soft bg-surface-white text-ink-caption shadow-sm active:scale-95"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2.6} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {chatOpen ? (
          <div className="fixed inset-0 z-[90] flex items-end justify-center">
            <button
              type="button"
              aria-label="닫기"
              className="absolute inset-0 bg-ink-heading/35 backdrop-blur-[2px]"
              onClick={() => setChatOpen(false)}
            />
            <div className="relative z-10 flex h-[min(78dvh,640px)] w-full max-w-mobile flex-col rounded-t-[28px] border border-line-soft bg-surface-white shadow-lg animate-fade-up">
              <div className="flex items-center gap-3 border-b border-line-soft px-4 py-3">
                <BuddyAvatar className="h-10 w-10 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold text-ink-heading">
                    MetU 버디
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setChatOpen(false)}
                  aria-label="챗봇 닫기"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-ink-caption active:bg-surface-soft"
                >
                  <X className="h-5 w-5" strokeWidth={2.2} />
                </button>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={[
                      "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                      msg.role === "buddy"
                        ? "self-start rounded-bl-md bg-surface-soft text-ink-body"
                        : "self-end rounded-br-md bg-brand text-surface-white",
                    ].join(" ")}
                  >
                    {msg.text}
                  </div>
                ))}
                {sending ? <BuddyTypingBubble /> : null}
                <div ref={chatEndRef} />
              </div>

              <div className="flex gap-2 overflow-x-auto px-4 pb-2">
                {QUICK_CHIPS.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    disabled={sending}
                    onClick={() => void sendUser(chip.label)}
                    className="shrink-0 rounded-full border border-line-soft bg-surface-base px-3 py-1.5 text-xs font-bold text-brand active:bg-surface-soft disabled:opacity-50"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              <form
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  const text = draft;
                  setDraft("");
                  void sendUser(text);
                }}
                className="flex gap-2 border-t border-line-soft px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3"
              >
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  disabled={sending}
                  placeholder="무엇이든 물어보세요…"
                  className="min-w-0 flex-1 rounded-xl2 border border-line-soft bg-surface-base px-3.5 py-2.5 text-sm text-ink-heading outline-none placeholder:text-ink-caption focus:border-brand/40 disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={sending || !draft.trim()}
                  className="shrink-0 rounded-xl2 bg-brand px-4 py-2.5 text-sm font-bold text-surface-white active:brightness-95 disabled:opacity-50"
                >
                  전송
                </button>
              </form>
            </div>
          </div>
        ) : null}
      </OverlayLayer>
    </EasterEggContext.Provider>
  );
}

export function useEasterEggToast() {
  const ctx = useContext(EasterEggContext);
  if (!ctx) {
    return {
      showToast: (_message: string) => {},
      summonBuddy: (_greeting?: string) => {},
    };
  }
  return ctx;
}

export const useEasterEgg = useEasterEggToast;

export function useSecretTap(params: {
  tapsRequired: number;
  windowMs?: number;
  onTrigger: () => void;
  onceKey?: string;
}) {
  const { tapsRequired, windowMs = 3000, onTrigger, onceKey } = params;
  const countRef = useRef(0);
  const firstTapRef = useRef(0);

  return useCallback(() => {
    const now = Date.now();
    if (now - firstTapRef.current > windowMs) {
      countRef.current = 0;
      firstTapRef.current = now;
    }

    countRef.current += 1;
    if (countRef.current < tapsRequired) return;

    countRef.current = 0;
    firstTapRef.current = 0;

    if (onceKey && typeof window !== "undefined") {
      try {
        sessionStorage.setItem(onceKey, "1");
      } catch {
        /* ignore */
      }
    }

    onTrigger();
  }, [tapsRequired, windowMs, onTrigger, onceKey]);
}
