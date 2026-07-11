import { NextResponse } from "next/server";

/**
 * Early-access: 데모 딜 큐레이션을 노출하지 않음.
 * 이후 실데이터/운영 큐레이션이 준비되면 다시 연결.
 */
export async function GET() {
  return NextResponse.json({ places: [], source: "early-access" });
}
