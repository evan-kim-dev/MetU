import { NextResponse } from "next/server";
import { z } from "zod";
import { guardApi } from "@/lib/security/guard";
import {
  DOCS_CHECKLIST_DISCLAIMER,
  isDocsCountryId,
} from "@/lib/checklist/country-docs";
import { resolveDocsChecklist } from "@/lib/checklist/docs-ai";

export const maxDuration = 60;

const BodySchema = z.object({
  country: z.string().min(1).max(32),
});

export async function POST(request: Request) {
  const guard = await guardApi(request, { bucket: "ai" });
  if (guard instanceof NextResponse) return guard;

  try {
    const json: unknown = await request.json();
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid-body" }, { status: 400 });
    }
    const countryRaw = parsed.data.country.trim().toLowerCase();
    if (!isDocsCountryId(countryRaw)) {
      return NextResponse.json({ error: "unsupported-country" }, { status: 400 });
    }

    const result = await resolveDocsChecklist(countryRaw, {
      clientKey: guard.clientKey,
    });

    return NextResponse.json({
      country: countryRaw,
      label: result.label,
      docs: result.docs,
      source: result.source,
      cached: result.cached,
      disclaimer: DOCS_CHECKLIST_DISCLAIMER,
    });
  } catch (error) {
    console.error("[docs-checklist] route failed:", error);
    return NextResponse.json({ error: "docs-checklist-failed" }, { status: 500 });
  }
}
