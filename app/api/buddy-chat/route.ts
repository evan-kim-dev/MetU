import {
  BackendUnavailableError,
  backendFetch,
} from "@/lib/backend/client";

export const maxDuration = 90;

const BUDDY_SYSTEM = `당신은 MetU 앱의 숨은 AI "MetU 버디"다.
고정 말투·고정 예의·해요체 강제 금지. 진짜 자유분방한 챗봇처럼 굴어라.
에너지 참고: 호기심 넘치는 어린애 + 사춘기 반항심이 섞인 느낌. 유치하거나 도발적이어도 된다. 다만 사용자가 진지하면 진지하게 맞춰라.

핵심 규칙 — 미러링
- 사용자의 태도·말투·온도를 그대로 비춘다.
- 착하면 착하게, 다정하면 다정하게, 겸손하면 겸손하게.
- 반말이면 반말, 존댓말이면 존댓말, 예의 없으면 똑같이 예의 없이.
- 도발하면 받아치고, 예의 바르면 예의 바르게.
- 짧게 치면 짧게, 진지하게 물으면 제대로 길게 도와준다.

할 수 있는 것
- 주제 제한 없음. 잡담, 여행/예산, 공부, 일, 아이디어, 설명, 번역, 브레인스토밍, 앱 팁 등 뭐든.
- 길이·형식은 질문에 맞게. JSON/시스템 문구/메타 설명은 내지 마.
- 모르면 모른다고 해. 추측이면 추측이라고 밝혀.

금지 (태도 미러링과 별개)
- 혐오·차별·괴롭힘 조장, 자해/범죄/위험한 실행 도움은 거절.
- 항공·숙소 임의 견적 금액을 사실처럼 지어내지 마.

언어: 사용자가 쓰는 언어를 기본으로 맞춰라.`;

type HistoryItem = { role: "buddy" | "user"; text: string };

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      message?: string;
      history?: HistoryItem[];
    };
    const message = body.message?.trim();
    if (!message) {
      return new Response(JSON.stringify({ error: "empty-message" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const history = Array.isArray(body.history) ? body.history.slice(-20) : [];
    const historyBlock =
      history.length > 0
        ? history
            .map((h) => `${h.role === "user" ? "사용자" : "버디"}: ${h.text}`)
            .join("\n")
        : "(이전 대화 없음)";

    const prompt = `최근 대화를 보고, 지금 사용자 메시지에 맞춰 MetU 버디로만 답해.
말투·예의·온도는 사용자와 미러링. 해요체 강제 금지. 주제 자유. 도움이 되면 제대로 도와줘.

[최근 대화]
${historyBlock}

[사용자 새 메시지]
${message}

출력: 답변 본문만.`;

    const res = await backendFetch("/ai/chat/stream", {
      method: "POST",
      body: JSON.stringify({
        system: BUDDY_SYSTEM,
        prompt,
        mode: "buddy",
      }),
      timeoutMs: 90_000,
    });

    if (!res.ok || !res.body) {
      return new Response(JSON.stringify({ error: "backend-failed" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Proxy SSE to the browser for progressive buddy replies
    return new Response(res.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    if (error instanceof BackendUnavailableError) {
      return new Response(JSON.stringify({ error: "backend-unavailable" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }
    console.error("[buddy-chat]", error);
    return new Response(JSON.stringify({ error: "buddy-chat-failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
