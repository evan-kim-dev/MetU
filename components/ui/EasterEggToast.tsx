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

const BUDDY_REPLIES: Record<string, string[]> = {
  default: [
    "저예요, MetU 버디. 지갑 감시 카메라 겸 양심이예요.",
    "숨은 메뉴까지 파고드는 열정이면, 예산 계산은 왜 대충이에요?",
    "여행은 설레야 해요. 통장 잔고만 설레면 그건 공포예요.",
    "말 걸었으면 각오하세요. 저는 달콤한 플래너가 아니라 팩트 담당이에요.",
  ],
  budget: [
    "그 예산으로 유럽이요? 수영해서 가든지, 저금통부터 부수든지요.",
    "1인당 15만 원 미만이면 왕복+숙박은 판타지 소설이에요. 현실 편 읽어요.",
    "유럽은 최소 250만 원대부터예요. 그 아래면 '유럽 가고 싶다'가 아니라 '유럽 꿈꿨다'예요.",
    "예산이 그 모양이면 목적지도 겸손해야 해요. 파리 대신 편의점 도시락부터.",
    "지갑이 울면 여행은 조용히 접어요. 제가 대신 울어 드릴 수는 없거든요.",
  ],
  secret: [
    "달·화성·호그와트 넣으면 제가 더 세게 놀려 드려요. 해보세요.",
    "홈 인사말을 3초 안에 일곱 번 두드리면 저를 불러요. 손가락 헬스예요.",
    "이스터 에그 찾는 근면함이면 항공권 비교는 왜 안 해요?",
  ],
  metu: [
    "Met U = Meet you. 당신과 예산이 먼저 만나야 여행도 만나요.",
    "저는 AI 비서예요. 듣기 좋은 말만 원하면 ChatGPT 가서 칭찬받아요.",
    "MetU는 여행 앱이지 소원 수리함이 아니에요. 숫자부터 맞춰요.",
  ],
};

const QUICK_CHIPS = [
  { id: "budget", label: "예산 조언" },
  { id: "secret", label: "숨은 팁" },
  { id: "metu", label: "Met U?" },
] as const;

function pickReply(pool: string[]): string {
  return pool[Math.floor(Math.random() * pool.length)] ?? pool[0];
}

function matchReply(input: string): string {
  const t = input.trim().toLowerCase();
  if (/예산|돈|만원|저금|싸/.test(t)) return pickReply(BUDDY_REPLIES.budget);
  if (/숨|이스터|비밀|달|화성|호그와트/.test(t))
    return pickReply(BUDDY_REPLIES.secret);
  if (/met|메트|너|누구|뭐야/.test(t)) return pickReply(BUDDY_REPLIES.metu);
  return pickReply(BUDDY_REPLIES.default);
}

function BuddyTypingBubble() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="버디가 답변 생성 중"
      className="relative self-start max-w-[85%] overflow-hidden rounded-2xl rounded-bl-md border border-brand/15 bg-gradient-to-br from-brand/8 via-surface-soft to-brand-soft/20 px-3.5 py-3 shadow-sm animate-fade-up"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-brand/10 to-transparent motion-safe:animate-shimmer"
      />
      <div className="relative flex items-center gap-2.5">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full rounded-full bg-brand/40 motion-safe:animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
        </span>
        <span className="flex items-center gap-1" aria-hidden>
          <span className="h-1.5 w-1.5 rounded-full bg-brand motion-safe:animate-typing-dot" />
          <span className="h-1.5 w-1.5 rounded-full bg-brand/75 motion-safe:animate-typing-dot [animation-delay:0.15s]" />
          <span className="h-1.5 w-1.5 rounded-full bg-brand/45 motion-safe:animate-typing-dot [animation-delay:0.3s]" />
        </span>
        <span className="text-sm font-medium text-ink-caption motion-safe:animate-buddy-think">
          팩트 조준 중
          <span className="inline-block w-4 text-left">…</span>
        </span>
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
        "손가락 근력이 여행 예산보다 낫네요. 반갑습니다, Met U.",
        "짠. 숨은 버디 출동. 칭찬은 없고 팩트만 있어요.",
        "예산 양심 담당이에요. 마음 약한 사람 말고 지갑 약한 사람 담당.",
      ]);
    setBuddyVisible(true);
    setBubble(line);
    if (bubbleTimer.current) window.clearTimeout(bubbleTimer.current);
    bubbleTimer.current = window.setTimeout(() => {
      setBubble(null);
      bubbleTimer.current = null;
    }, 4500);
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
              text: "안녕하세요. MetU 버디예요. 달콤한 위로 원하면 다른 앱 가세요. 여기는 야유와 예산 팩트만 팔아요.",
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

      try {
        const res = await fetch("/api/buddy-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            history: historyForApi.slice(0, -1),
          }),
        });
        if (!res.ok) throw new Error("buddy-failed");
        const data = (await res.json()) as { reply?: string };
        const reply = data.reply?.trim();
        if (!reply) throw new Error("empty-reply");
        pushBuddy(reply);
      } catch {
        pushBuddy(matchReply(trimmed));
      } finally {
        setSending(false);
      }
    },
    [pushBuddy, sending]
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
                <button
                  type="button"
                  onClick={openChat}
                  aria-label="MetU 버디와 대화하기"
                  className="pointer-events-auto relative flex h-16 w-16 items-center justify-center rounded-full border-2 border-brand/30 bg-surface-white shadow-glow transition-transform active:scale-95 animate-buddy-pop"
                >
                  <BuddyAvatar className="h-12 w-12 motion-safe:animate-float-soft" />
                </button>
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
            <div className="relative z-10 flex h-[min(70dvh,520px)] w-full max-w-mobile flex-col rounded-t-[28px] border border-line-soft bg-surface-white shadow-lg animate-fade-up">
              <div className="flex items-center gap-3 border-b border-line-soft px-4 py-3">
                <BuddyAvatar className="h-10 w-10 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold text-ink-heading">
                    MetU 버디
                  </p>
                  <p className="text-2xs font-medium text-ink-caption">
                    숨은 여행 상담 · 이스터 에그
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
                      "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
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
                  placeholder="버디에게 한마디…"
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
