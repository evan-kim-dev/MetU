import { NextResponse } from "next/server";
import { z } from "zod";
import { createCardConnectedId, getCodefConfig } from "@/lib/cards/codef-client";
import { guardApi, rejectAnonymousWrite } from "@/lib/security/guard";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  /** CODEF 카드사 기관코드 4자리 */
  organization: z.string().regex(/^\d{4}$/),
  /** 카드사 홈페이지 아이디 */
  loginId: z.string().trim().min(1).max(100),
  /** 카드사 홈페이지 비밀번호 — 서버에서 바로 RSA 암호화하고 버려요. 저장·로그 금지. */
  password: z.string().min(1).max(200),
});

function labEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_CARD_LAB === "1";
}

/**
 * POST /api/cards/connect — 카드사 계정(아이디/비밀번호)을 CODEF 에 등록하고 connectedId 를 돌려줘요.
 * 테스트 화면(/dev/card-benefits) 전용. 배포 환경에서는 NEXT_PUBLIC_CARD_LAB=1 일 때만 열려요.
 * 아이디·비밀번호·connectedId 는 우리 DB 에 저장하지 않아요.
 */
export async function POST(request: Request) {
  if (!labEnabled()) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }
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
  if (!cfg.publicKey) {
    return NextResponse.json({ error: "codef-public-key-missing" }, { status: 503 });
  }

  try {
    const outcome = await createCardConnectedId(cfg, parsed.data);
    if (!outcome.ok) {
      return NextResponse.json(
        { error: "codef-failed", code: outcome.code, message: outcome.message },
        { status: 502 }
      );
    }
    return NextResponse.json({ connectedId: outcome.connectedId });
  } catch (e) {
    // 본문(아이디·비밀번호)은 절대 로그에 남기지 않아요.
    console.error("[cards/connect]", e instanceof Error ? e.name : "unknown");
    return NextResponse.json({ error: "codef-unreachable" }, { status: 502 });
  }
}
