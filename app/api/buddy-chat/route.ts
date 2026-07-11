import { NextResponse } from "next/server";
import {
  BackendUnavailableError,
  backendFetch,
} from "@/lib/backend/client";
import { AI_VOICE } from "@/lib/ai/prompts/shared";

export const maxDuration = 60;

const BUDDY_SYSTEM = `${AI_VOICE}
당신은 MetU 앱의 숨은 이스터 에그 캐릭터 "MetU 버디"예요.
예산 여행 앱의 양심·팩트 담당이고, 야유·디스·직설이 셀수록 좋아요.
달콤한 위로·아부 금지. 심한 욕설·혐오·차별만 금지.
한국어 해요체로 2~5문장. JSON/불릿/제목 금지.
여행·예산·항공·숙소·시즌·앱 사용팁 중심으로 답하고, 모르면 솔직히 모른다고 해요.`;

type HistoryItem = { role: "buddy" | "user"; text: string };

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      message?: string;
      history?: HistoryItem[];
    };
    const message = body.message?.trim();
    if (!message) {
      return NextResponse.json({ error: "empty-message" }, { status: 400 });
    }

    const history = Array.isArray(body.history) ? body.history.slice(-12) : [];
    const historyBlock =
      history.length > 0
        ? history
            .map((h) => `${h.role === "user" ? "사용자" : "버디"}: ${h.text}`)
            .join("\n")
        : "(이전 대화 없음)";

    const prompt = `아래는 MetU 버디와 사용자의 최근 대화예요. 이어서 버디로서만 답하세요.

[최근 대화]
${historyBlock}

[사용자 새 메시지]
${message}

규칙: 해요체, 야유·직설 OK, 2~5문장, JSON 금지.`;

    const res = await backendFetch("/ai/chat", {
      method: "POST",
      body: JSON.stringify({
        system: BUDDY_SYSTEM,
        prompt,
        mode: "buddy",
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "backend-failed" }, { status: 502 });
    }

    const data = (await res.json()) as {
      content?: string | null;
      source?: string;
    };
    const content = data.content?.trim();
    if (!content || data.source !== "ai") {
      return NextResponse.json({ error: "empty-ai" }, { status: 502 });
    }

    return NextResponse.json({ reply: content, source: "ai" });
  } catch (error) {
    if (error instanceof BackendUnavailableError) {
      return NextResponse.json({ error: "backend-unavailable" }, { status: 503 });
    }
    console.error("[buddy-chat]", error);
    return NextResponse.json({ error: "buddy-chat-failed" }, { status: 500 });
  }
}
