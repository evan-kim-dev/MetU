import { NextResponse } from "next/server";
import { buildLocalPartyInsight } from "@/lib/ai/party-insight";
import {
  BackendUnavailableError,
  backendFetch,
} from "@/lib/backend/client";
import {
  buildPartyPrompt,
  getBudgetSystemPrompt,
  looksLikeFakeQuote,
} from "@/lib/ai/prompts/insight-prompts";
import {
  retrieveBudgetRag,
  violatesBudgetBand,
} from "@/lib/rag/budgetBands";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const budget = Number(searchParams.get("budget") ?? "0");
  const people = Number(searchParams.get("people") ?? "1");
  const monthParam = Number(searchParams.get("month") ?? "0");
  const month =
    monthParam >= 1 && monthParam <= 12
      ? monthParam
      : new Date().getMonth() + 1;

  if (!Number.isFinite(budget) || budget < 0) {
    return NextResponse.json({ error: "invalid-budget" }, { status: 400 });
  }
  if (!Number.isFinite(people) || people < 1 || people > 20) {
    return NextResponse.json({ error: "invalid-people" }, { status: 400 });
  }

  const fallback = buildLocalPartyInsight(budget, people, month);
  const perPerson = people > 0 ? Math.floor(budget / people) : budget;
  const rag = retrieveBudgetRag(perPerson, month);

  if (budget <= 0) {
    return NextResponse.json({
      insight: fallback,
      source: "local",
      rag: rag.contexts,
    });
  }

  const prompt = buildPartyPrompt(budget, people, month);
  const system = getBudgetSystemPrompt();

  try {
    const res = await backendFetch("/ai/chat", {
      method: "POST",
      body: JSON.stringify({ system, prompt, mode: "party" }),
    });

    if (!res.ok) {
      return NextResponse.json({
        insight: fallback,
        source: "fallback",
        rag: rag.contexts,
      });
    }

    const data = (await res.json()) as {
      content?: string | null;
      source?: string;
    };
    const content = data.content?.trim();

    if (
      !content ||
      looksLikeFakeQuote(content) ||
      violatesBudgetBand(content, perPerson)
    ) {
      return NextResponse.json({
        insight: fallback,
        source: "fallback",
        rag: rag.contexts,
      });
    }

    return NextResponse.json({
      insight: content,
      source: data.source === "ai" ? "ai+rag" : "fallback",
      rag: rag.contexts,
    });
  } catch (error) {
    if (!(error instanceof BackendUnavailableError)) {
      /* ignore */
    }
    return NextResponse.json({
      insight: fallback,
      source: "fallback",
      rag: rag.contexts,
    });
  }
}
