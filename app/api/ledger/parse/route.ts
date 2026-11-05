import { NextResponse } from "next/server";
import { readJsonLimited } from "@/lib/agent/body-limit";
import { redactSensitiveText } from "@/lib/agent/receipt-vision";
import { aiChatOrNull } from "@/lib/ai/chat-client";
import { parseExpenseParseOut } from "@/lib/ai/contracts";
import { guardApi } from "@/lib/security/guard";

export const maxDuration = 60;

type ParseBody = {
  text?: string;
  members?: Array<{ id: string; displayName: string }>;
  places?: Array<{ id: string; title: string }>;
  defaultCurrency?: string;
  meId?: string;
  today?: string;
};

export async function POST(request: Request) {
  const guard = await guardApi(request, { bucket: "ai" });
  if (guard instanceof NextResponse) return guard;
  const { clientKey } = guard;

  const limited = await readJsonLimited(request, 32_768);
  if (!limited.ok) return limited.response;
  const body = limited.json as ParseBody;

  const text = body.text?.trim() ?? "";
  const members = body.members ?? [];
  if (!text || members.length === 0) {
    return NextResponse.json(
      { error: "invalid-body", message: "문구와 멤버를 확인해 주세요." },
      { status: 400 }
    );
  }

  const meId = body.meId ?? members[0]!.id;
  const today = body.today ?? new Date().toISOString().slice(0, 10);
  const defaultCurrency = (body.defaultCurrency ?? "KRW").toUpperCase();
  // 규칙 18: LLM 로 나가기 전 카드·주민번호 형태 마스킹
  const safeText = redactSensitiveText(text);

  try {
    const chat = await aiChatOrNull({
      mode: "expense_parse",
      clientKey,
      system:
        "자연어 지출을 구조화해요. '나'/'내가'는 meId. 사람 이름은 members id 로만 매핑하고 목록에 없으면 null + needsClarification. 통화 기호/단어를 ISO 코드로, 상대 날짜는 today 기준 ISO 로. 금액을 추측하지 마세요. JSON만 출력.",
      prompt: [
        `text: ${safeText}`,
        `meId: ${meId}`,
        `today: ${today}`,
        `defaultCurrency: ${defaultCurrency}`,
        `members: ${JSON.stringify(members)}`,
        `places: ${JSON.stringify(body.places ?? [])}`,
      ].join("\n"),
    });

    const parsed = chat?.content
      ? parseExpenseParseOut(chat.content)
      : {
          items: [],
          needsClarification:
            "지출을 이해하지 못했어요. 직접 입력해 주세요.",
        };

    return NextResponse.json({
      ...parsed,
      source: chat?.source ?? "fallback",
    });
  } catch (error) {
    console.error(
      "[api/ledger/parse]",
      error instanceof Error ? error.message : error
    );
    return NextResponse.json(
      {
        error: "expense-parse-failed",
        message: "분석에 실패했어요. 직접 입력해 주세요.",
      },
      { status: 500 }
    );
  }
}
