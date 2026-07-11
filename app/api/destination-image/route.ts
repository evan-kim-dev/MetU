import { NextResponse } from "next/server";
import {
  DEFAULT_DESTINATION_IMAGE,
  isGenericTripImage,
  resolveDestinationImage,
  wikiTitleCandidates,
} from "@/lib/trips/destination-image";

export const maxDuration = 20;

type WikiSummary = {
  thumbnail?: { source?: string };
  originalimage?: { source?: string };
  type?: string;
};

async function fetchWikiThumbnail(
  lang: "en" | "ko",
  title: string
): Promise<string | null> {
  const encoded = encodeURIComponent(title.replace(/\s+/g, "_"));
  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encoded}`;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Api-User-Agent": "MetU/1.0 (travel-app; destination-image)",
      },
      next: { revalidate: 60 * 60 * 24 * 7 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as WikiSummary;
    if (data.type === "disambiguation") return null;
    return (
      data.originalimage?.source?.trim() ||
      data.thumbnail?.source?.trim() ||
      null
    );
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const destination = (searchParams.get("destination") ?? "").trim();
  const country = (searchParams.get("country") ?? "").trim();
  const stored = (searchParams.get("stored") ?? "").trim();

  if (!destination && !country) {
    return NextResponse.json({ error: "missing-destination" }, { status: 400 });
  }

  if (stored && !isGenericTripImage(stored)) {
    return NextResponse.json({ imageUrl: stored, source: "stored" });
  }

  const curated = resolveDestinationImage(destination || country, country);
  if (curated !== DEFAULT_DESTINATION_IMAGE) {
    return NextResponse.json({ imageUrl: curated, source: "curated" });
  }

  const titles = wikiTitleCandidates(destination || country, country);
  for (const title of titles) {
    for (const lang of ["en", "ko"] as const) {
      const thumb = await fetchWikiThumbnail(lang, title);
      if (thumb) {
        return NextResponse.json({
          imageUrl: thumb,
          source: `wikipedia:${lang}`,
        });
      }
    }
  }

  return NextResponse.json({
    imageUrl: DEFAULT_DESTINATION_IMAGE,
    source: "default",
  });
}
