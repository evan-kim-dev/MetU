import { NextResponse } from "next/server";
import {
  BackendUnavailableError,
  backendFetch,
} from "@/lib/backend/client";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requiredItemId = searchParams.get("requiredItemId");
  if (!requiredItemId) {
    return NextResponse.json({ error: "missing-required-item-id" }, { status: 400 });
  }

  try {
    const res = await backendFetch(
      `/checklist/withact/details?requiredItemId=${encodeURIComponent(requiredItemId)}`
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    if (error instanceof BackendUnavailableError) {
      return NextResponse.json({ error: "backend-unavailable" }, { status: 503 });
    }
    return NextResponse.json({ error: "checklist-details-failed" }, { status: 500 });
  }
}
