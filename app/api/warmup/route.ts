import { NextResponse } from "next/server";

/** Warm Next serverless / Gemini path — no FastAPI. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    stack: "next+gemini",
    ts: new Date().toISOString(),
  });
}
