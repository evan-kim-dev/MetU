import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeCodefCard } from "@/lib/cards/benefits";
import { fetchCardResultCheck, getCodefConfig } from "@/lib/cards/codef-client";
import { guardApi, rejectAnonymousWrite } from "@/lib/security/guard";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  /** CODEF 카드사 기관코드 4자리 */
  organization: z.string().regex(/^\d{4}$/),
  /** CODEF 계정등록으로 만든 connectedId (카드사 비밀번호는 받지 않아요) */
  connectedId: z.string().min(1).max(100),
  /** YYYYMM */
  startDate: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
});

/**
 * POST /api/cards/benefits — CODEF 개인카드 실적·혜택 조회 → 정규화된 카드 목록.
 * 카드번호는 끝 4자리만 내려요. 키가 없으면 503 (화면은 예시 데이터로 대체).
 */
export async function POST(request: Request) {
  const guard = await guardApi(request, { bucket: "cards" });
  if (guard instanceof NextResponse) return guard;
  const guest = rejectAnonymousWrite(guard.identity);
  if (guest) return guest;

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  const cfg = getCodefConfig();
  if (!cfg) {
    return NextResponse.json({ error: "codef-not-configured" }, { status: 503 });
  }

  try {
    const outcome = await fetchCardResultCheck(cfg, parsed.data);
    if (!outcome.ok) {
      return NextResponse.json(
        { error: "codef-failed", code: outcome.code, message: outcome.message },
        { status: 502 }
      );
    }
    return NextResponse.json({
      cards: outcome.cards.map((c, i) => normalizeCodefCard(c, i)),
    });
  } catch (e) {
    console.error("[cards/benefits]", e instanceof Error ? e.message : "unknown");
    return NextResponse.json({ error: "codef-unreachable" }, { status: 502 });
  }
}
