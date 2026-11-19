import { NextResponse } from "next/server";
import { z } from "zod";

import {
  intentPatchIsEmpty,
  mergeOnboardingIntent,
  PARSE_INTENT_TEXT_MAX,
  type OnboardingIntentPatch,
} from "@/lib/onboarding/parse-intent";
import { interpretOnboardingIntent } from "@/lib/onboarding/parse-intent-server";
import { INITIAL_FORM, type OnboardingForm } from "@/lib/onboarding/types";
import { guardApi } from "@/lib/security/guard";
import { identitySubject } from "@/lib/security/identity";

export const maxDuration = 30;

const BodySchema = z.object({
  text: z.string().trim().min(1).max(PARSE_INTENT_TEXT_MAX),
  form: z
    .object({
      budget: z.string(),
      people: z.number(),
      origin: z.string(),
      destination: z.string(),
      dateType: z.enum(["specific", "flexible"]),
      startDate: z.string(),
      endDate: z.string(),
      flexibleYear: z.number(),
      flexibleMonth: z.number(),
      styles: z.array(z.string()),
    })
    .partial()
    .optional(),
});

function asForm(partial?: z.infer<typeof BodySchema>["form"]): OnboardingForm {
  if (!partial) return { ...INITIAL_FORM };
  return {
    ...INITIAL_FORM,
    ...partial,
    styles: Array.isArray(partial.styles)
      ? (partial.styles as OnboardingForm["styles"])
      : INITIAL_FORM.styles,
  };
}

export async function POST(request: Request) {
  const guard = await guardApi(request, { bucket: "ai" });
  if (guard instanceof NextResponse) return guard;

  let body: z.infer<typeof BodySchema>;
  try {
    const raw: unknown = await request.json();
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid-request" }, { status: 400 });
    }
    body = parsed.data;
  } catch {
    return NextResponse.json({ error: "invalid-request" }, { status: 400 });
  }

  const { patch, source } = await interpretOnboardingIntent({
    text: body.text,
    userId: identitySubject(guard.identity),
  });

  const form = mergeOnboardingIntent(asForm(body.form), patch);
  const empty = intentPatchIsEmpty(patch);

  return NextResponse.json({
    ok: true as const,
    source,
    empty,
    patch: patch as OnboardingIntentPatch,
    form,
    message: empty
      ? "알아듣지 못했어요. 아래를 직접 골라 주세요."
      : source === "ai"
        ? "아래를 채워 두었어요. 필요하면 고쳐 주세요."
        : "일부만 채웠어요. 필요하면 고쳐 주세요.",
  });
}
