"use client";

import { useEffect, useMemo, useState } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { VisitedCountrySheet } from "@/components/trips/VisitedCountrySheet";
import {
  collectVisitedCountryIsos,
  countryAlpha2FromIso,
  countryLabelFromIso,
} from "@/lib/trips/visited-countries";
import type { Trip } from "@/lib/trips/types";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const WIDTH = 800;
const HEIGHT = 420;
const PAD = 12;

type VisitedWorldMapProps = {
  trips: Trip[];
};

function toIso(id: Feature["id"]): string {
  if (id === undefined || id === null) return "";
  return String(Number(id));
}

export function VisitedWorldMap({ trips }: VisitedWorldMapProps) {
  const [collection, setCollection] =
    useState<FeatureCollection<Geometry> | null>(null);
  const [failed, setFailed] = useState(false);
  const [selectedIso, setSelectedIso] = useState<string | null>(null);

  const visited = useMemo(
    () => new Set(collectVisitedCountryIsos(trips)),
    [trips]
  );

  const visitedIsos = useMemo(
    () =>
      [...visited].sort((a, b) =>
        countryLabelFromIso(a).localeCompare(countryLabelFromIso(b), "ko")
      ),
    [visited]
  );

  const land = useMemo(() => {
    if (!collection) return null;
    const features = collection.features.filter(
      (geo) => toIso(geo.id) !== "10"
    );
    return {
      type: "FeatureCollection",
      features,
    } satisfies FeatureCollection<Geometry>;
  }, [collection]);

  const pathBuilder = useMemo(() => {
    if (!land) return null;
    const projection = geoNaturalEarth1().fitExtent(
      [
        [PAD, PAD],
        [WIDTH - PAD, HEIGHT - PAD],
      ],
      land
    );
    return geoPath(projection);
  }, [land]);

  useEffect(() => {
    let cancelled = false;
    void fetch(GEO_URL)
      .then(async (res) => {
        if (!res.ok) throw new Error("geo-fetch-failed");
        return res.json();
      })
      .then((topology: unknown) => {
        if (cancelled) return;
        const topo = topology as {
          objects: { countries: Parameters<typeof feature>[1] };
        };
        const countries = feature(
          topology as Parameters<typeof feature>[0],
          topo.objects.countries
        ) as unknown as FeatureCollection<Geometry>;
        setCollection(countries);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) return null;

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-line-soft bg-surface-white shadow-sm">
        <div className="flex items-start justify-between gap-3 px-4 pb-1 pt-4">
          <div className="min-w-0">
            <h2 className="text-sm font-extrabold text-ink-heading">방문 지도</h2>
            <p className="mt-0.5 text-xs text-ink-caption">
              {visited.size > 0
                ? `${visited.size}개국에 발자국을 남겼어요 · 나라를 눌러 보세요`
                : "여행을 저장하면 방문한 나라가 채워져요"}
            </p>
          </div>
          {visited.size > 0 ? (
            <span className="shrink-0 rounded-full bg-brand/10 px-2.5 py-1 text-2xs font-bold text-brand">
              {visited.size}개국
            </span>
          ) : null}
        </div>

        <div className="relative px-3 pb-2">
          {!land || !pathBuilder ? (
            <div className="mb-2 aspect-[800/420] animate-pulse rounded-xl bg-surface-soft" />
          ) : (
            <div className="aspect-[800/420] w-full overflow-hidden rounded-xl bg-gradient-to-b from-[#EEF3FF] to-[#E7EEFA]">
              <svg
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                preserveAspectRatio="xMidYMid meet"
                className="block h-full w-full"
                role="img"
                aria-label="내가 다녀온 국가가 색으로 표시된 세계 지도"
              >
                {land.features.map((geo, index) => {
                  const iso = toIso(geo.id);
                  const d = pathBuilder(geo);
                  if (!d) return null;
                  const isVisited = iso !== "" && visited.has(iso);
                  return (
                    <path
                      key={iso || `g-${index}`}
                      d={d}
                      fill={
                        selectedIso === iso
                          ? "#1D4ED8"
                          : isVisited
                            ? "#2563EB"
                            : "#DDE6F6"
                      }
                      stroke={isVisited ? "#004AC6" : "#C5D3EB"}
                      strokeWidth={isVisited ? 0.7 : 0.35}
                      strokeLinejoin="round"
                      className={
                        isVisited
                          ? "cursor-pointer transition-opacity hover:opacity-90"
                          : undefined
                      }
                      onClick={() => {
                        if (!isVisited) return;
                        setSelectedIso(iso);
                      }}
                    >
                      {isVisited ? (
                        <title>{countryLabelFromIso(iso)}</title>
                      ) : null}
                    </path>
                  );
                })}
              </svg>
            </div>
          )}

          {visitedIsos.length > 0 ? (
            <div className="px-1 py-2">
              <div
                className="flex justify-start gap-1.5 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                {visitedIsos.map((iso) => {
                  const label = countryLabelFromIso(iso);
                  const alpha2 = countryAlpha2FromIso(iso)?.toLowerCase();
                  if (!alpha2) return null;
                  return (
                    <button
                      key={iso}
                      type="button"
                      title={label}
                      aria-label={`${label} 상세 보기`}
                      onClick={() => setSelectedIso(iso)}
                      className="inline-flex shrink-0 items-center justify-center"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`https://flagcdn.com/w40/${alpha2}.png`}
                        alt={label}
                        width={24}
                        height={18}
                        className="h-[15px] w-5 rounded-[2px] object-cover"
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="px-4 pb-3 pt-1 text-center text-xs text-ink-caption">
              예: 일본·태국·프랑스 여행을 추가해 보세요
            </p>
          )}
        </div>
      </section>

      {selectedIso ? (
        <VisitedCountrySheet
          isoNumeric={selectedIso}
          trips={trips}
          onClose={() => setSelectedIso(null)}
        />
      ) : null}
    </>
  );
}
