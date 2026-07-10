import { NextResponse } from "next/server";
import { buildLocalBudgetInsight } from "@/lib/ai/budget-insight";
import type { BudgetInsightRecord, BudgetInsightSource } from "@/lib/ai/budget-insight-record";
import { persistBudgetInsightLog } from "@/lib/ai/persist-budget-insight";
import { backendFetch } from "@/lib/backend/client";
import {
  buildBudgetPrompt,
  getBudgetSystemPrompt,
  looksLikeFakeQuote,
} from "@/lib/ai/prompts/insight-prompts";
import {
  retrieveBudgetRag,
  violatesBudgetBand,
} from "@/lib/rag/budgetBands";

type BuildResult = {
  record: BudgetInsightRecord;
};

function buildRecord(
  budget: number,
  insight: string,
  source: BudgetInsightSource,
  localFallback: string,
  month: number
): BudgetInsightRecord {
  const rag = retrieveBudgetRag(budget, month);
  return {
    budget,
    month,
    insight,
    source,
    localFallback,
    rag: {
      bandId: rag.band.id,
      allowedRegions: rag.allowedRegions,
      contexts: rag.contexts,
      seasonTip: rag.seasonTip,
      recommendedNights: rag.band.nights,
    },
    createdAt: new Date().toISOString(),
  };
}

async function buildBudgetInsight(budget: number): Promise<BuildResult> {
  const fallback = buildLocalBudgetInsight(budget);
  const month = new Date().getMonth() + 1;
  const rag = retrieveBudgetRag(budget, month);

  if (budget <= 0) {
    return {
      record: buildRecord(budget, fallback, "local", fallback, month),
    };
  }

  const prompt = buildBudgetPrompt(budget, month);
  const system = getBudgetSystemPrompt();

  try {
    const res = await backendFetch("/ai/chat", {
      method: "POST",
      body: JSON.stringify({ system, prompt, mode: "budget" }),
    });

    if (!res.ok) {
      return {
        record: buildRecord(budget, fallback, "fallback", fallback, month),
      };
    }

    const data = (await res.json()) as {
      content?: string | null;
      source?: string;
    };
    const content = data.content?.trim();
    if (
      !content ||
      looksLikeFakeQuote(content) ||
      violatesBudgetBand(content, budget)
    ) {
      return {
        record: buildRecord(budget, fallback, "fallback", fallback, month),
      };
    }

    const source: BudgetInsightSource =
      data.source === "ai" ? "ai+rag" : "fallback";
    return {
      record: buildRecord(budget, content, source, fallback, month),
    };
  } catch {
    return {
      record: buildRecord(budget, fallback, "fallback", fallback, month),
    };
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const budget = Number(searchParams.get("budget") ?? "0");

  if (!Number.isFinite(budget) || budget < 0) {
    return NextResponse.json({ error: "invalid-budget" }, { status: 400 });
  }

  const { record } = await buildBudgetInsight(budget);

  void persistBudgetInsightLog(record);

  return NextResponse.json({    insight: record.insight,
    source: record.source,
  });
}
