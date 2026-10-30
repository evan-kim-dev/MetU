"use client";

import { useEffect, useRef, useState } from "react";
import {
  searchLocalPlaceItems,
  type PlaceAutocompleteMode,
  type PlaceAutocompleteSource,
  type PlaceItem,
} from "@/lib/places/autocomplete";

type CacheEntry = {
  items: PlaceItem[];
  source: PlaceAutocompleteSource;
};

const LRU_MAX = 100;
const cache = new Map<string, CacheEntry>();

function cacheKey(query: string, mode: PlaceAutocompleteMode): string {
  return `${mode}:${query.trim().toLowerCase()}`;
}

function cacheGet(key: string): CacheEntry | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  cache.delete(key);
  cache.set(key, hit);
  return hit;
}

function cacheSet(key: string, entry: CacheEntry): void {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, entry);
  while (cache.size > LRU_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/** 테스트용: 훅 LRU 캐시 비우기 */
export function clearPlaceAutocompleteCache(): void {
  cache.clear();
}

type AutocompleteResponse = {
  source?: PlaceAutocompleteSource;
  items?: PlaceItem[];
};

export function usePlaceAutocomplete(
  query: string,
  mode: PlaceAutocompleteMode = "all"
): {
  items: PlaceItem[];
  loading: boolean;
  source: PlaceAutocompleteSource | null;
} {
  const trimmed = query.trim();
  const [items, setItems] = useState<PlaceItem[]>(() =>
    trimmed ? [] : searchLocalPlaceItems("", mode, 40)
  );
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<PlaceAutocompleteSource | null>(
    trimmed ? null : "local"
  );
  const abortRef = useRef<AbortController | null>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    if (!trimmed) {
      abortRef.current?.abort();
      setItems(searchLocalPlaceItems("", mode, 40));
      setLoading(false);
      setSource("local");
      return;
    }

    const key = cacheKey(trimmed, mode);
    const cached = cacheGet(key);
    if (cached) {
      setItems(cached.items);
      setSource(cached.source);
      setLoading(false);
      return;
    }

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      const local = searchLocalPlaceItems(trimmed, mode, 40);
      setItems(local);
      setSource("local");
      setLoading(false);
      cacheSet(key, { items: local, source: "local" });
      return;
    }

    const seq = ++seqRef.current;
    setLoading(true);
    const timer = window.setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const url = `/api/places/autocomplete?q=${encodeURIComponent(trimmed)}&mode=${mode}&limit=20`;
      void fetch(url, { signal: controller.signal })
        .then(async (res) => {
          if (!res.ok) throw new Error(`status ${res.status}`);
          return (await res.json()) as AutocompleteResponse;
        })
        .then((data) => {
          if (seq !== seqRef.current) return;
          const nextItems = Array.isArray(data.items) ? data.items : [];
          const nextSource: PlaceAutocompleteSource =
            data.source === "remote" ? "remote" : "local";
          const finalItems =
            nextItems.length > 0
              ? nextItems
              : searchLocalPlaceItems(trimmed, mode, 40);
          const finalSource =
            nextItems.length > 0 ? nextSource : ("local" as const);
          setItems(finalItems);
          setSource(finalSource);
          setLoading(false);
          cacheSet(key, { items: finalItems, source: finalSource });
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          if (seq !== seqRef.current) return;
          const local = searchLocalPlaceItems(trimmed, mode, 40);
          setItems(local);
          setSource("local");
          setLoading(false);
          cacheSet(key, { items: local, source: "local" });
          if (error instanceof Error && error.name === "AbortError") return;
        });
    }, 200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [trimmed, mode]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return { items, loading, source };
}
