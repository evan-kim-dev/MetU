"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { MapPin, Plane, Search, X } from "lucide-react";
import {
  formatPlaceLabel,
  groupPlacesByContinent,
  searchAirportPlaces,
  type AirportPlace,
} from "@/lib/airports/data";
import {
  mergeAirportPlaces,
  searchAirportsFromApi,
} from "@/lib/airports/kac";

interface AirportSearchFieldProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  /** 선택 시 값 포맷 (기본: place.name) */
  formatValue?: (place: AirportPlace) => string;
  variant?: "default" | "compact";
}

export function AirportSearchField({
  label,
  placeholder,
  value,
  onChange,
  formatValue = formatPlaceLabel,
  variant = "default",
}: AirportSearchFieldProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [apiResults, setApiResults] = useState<AirportPlace[]>([]);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery(value);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [value]);

  const searchText = useMemo(() => {
    if (!open) return "";
    if (query.trim() === value.trim()) return "";
    return query;
  }, [open, query, value]);

  const staticResults = useMemo(
    () => searchAirportPlaces(searchText, 40),
    [searchText]
  );

  useEffect(() => {
    if (!open) {
      setApiResults([]);
      return;
    }

    const activeQuery = searchText.trim();
    if (!activeQuery) {
      setApiResults([]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void searchAirportsFromApi(activeQuery, 40).then((places) => {
        if (!cancelled) setApiResults(places);
      });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, searchText]);

  const results = useMemo(
    () => mergeAirportPlaces(staticResults, apiResults, 40),
    [staticResults, apiResults]
  );

  const groupedResults = useMemo(
    () => groupPlacesByContinent(results),
    [results]
  );

  const handleSelect = (place: AirportPlace) => {
    const next = formatValue(place);
    onChange(next);
    setQuery(next);
    setOpen(false);
  };

  const isCompact = variant === "compact";

  return (
    <div ref={rootRef} className="relative flex flex-col gap-1">
      <span
        className={
          isCompact
            ? "text-xs font-semibold text-ink-caption"
            : "text-sm font-semibold text-ink-body"
        }
      >
        {label}
      </span>
      <div className="flex gap-1.5">
        <div
          className={[
            "group flex min-w-0 flex-1 items-center gap-2 border bg-surface-white transition-all",
            isCompact ? "h-10 rounded-lg px-3" : "rounded-2xl px-4",
            open
              ? "border-brand ring-4 ring-brand/10"
              : isCompact
                ? "border-line-soft focus-within:border-brand"
                : "border-line-muted focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10",
          ].join(" ")}
        >
          {!isCompact ? (
            <Search className="h-4 w-4 shrink-0 text-ink-caption" strokeWidth={2.2} />
          ) : null}
          <input
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            autoComplete="off"
            placeholder={placeholder}
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              onChange(e.target.value);
              setOpen(true);
            }}
            className={[
              "w-full min-w-0 flex-1 bg-transparent text-ink-heading placeholder:text-ink-caption/70 focus:outline-none",
              isCompact ? "text-sm" : "py-3.5 text-base",
            ].join(" ")}
          />
          {query && !isCompact ? (
            <button
              type="button"
              aria-label="입력 지우기"
              onClick={() => {
                setQuery("");
                onChange("");
                setOpen(true);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-full text-ink-caption transition-colors active:bg-surface-soft"
            >
              <X className="h-4 w-4" strokeWidth={2.4} />
            </button>
          ) : null}
        </div>
      </div>

      {open && (
        <ul
          id={listId}
          role="listbox"
          className={[
            "absolute left-0 right-0 z-40 max-h-72 overflow-y-auto border border-line-soft bg-surface-white py-1 shadow-soft",
            isCompact
              ? "top-[calc(100%+4px)] rounded-lg"
              : "top-[calc(100%+6px)] rounded-2xl",
          ].join(" ")}
        >
          {results.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-ink-caption">
              검색 결과가 없어요
            </li>
          ) : (
            groupedResults.map((group) => (
              <li key={group.id} role="presentation">
                <div
                  className={[
                    "sticky top-0 z-[1] border-b border-line-soft/80 bg-surface-soft/95 px-3 py-1.5 text-[11px] font-bold tracking-wide text-ink-caption backdrop-blur-sm",
                    isCompact ? "px-2.5" : "px-4",
                  ].join(" ")}
                >
                  {group.label}
                </div>
                <ul role="group" aria-label={group.label}>
                  {group.places.map((place) => {
                    const isAirport = place.kind === "airport";
                    const selected = value === formatValue(place);
                    return (
                      <li key={place.id} role="option" aria-selected={selected}>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleSelect(place)}
                          className={[
                            "flex w-full items-start gap-2.5 text-left transition-colors",
                            isCompact ? "px-3 py-2" : "gap-3 px-4 py-2.5",
                            selected
                              ? "bg-brand/8"
                              : "hover:bg-surface-soft active:bg-surface-soft",
                            isAirport ? (isCompact ? "pl-6" : "pl-8") : "",
                          ].join(" ")}
                        >
                          <span
                            className={[
                              "mt-0.5 flex shrink-0 items-center justify-center rounded-full",
                              isCompact ? "h-6 w-6" : "h-8 w-8",
                              isAirport
                                ? "bg-surface-soft text-ink-caption"
                                : "bg-brand/10 text-brand",
                            ].join(" ")}
                          >
                            {isAirport ? (
                              <Plane
                                className={isCompact ? "h-3 w-3" : "h-4 w-4"}
                                strokeWidth={2.2}
                              />
                            ) : (
                              <MapPin
                                className={isCompact ? "h-3 w-3" : "h-4 w-4"}
                                strokeWidth={2.2}
                              />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span
                              className={[
                                "block truncate font-bold text-ink-heading",
                                isCompact ? "text-xs" : "text-sm",
                              ].join(" ")}
                            >
                              {formatValue(place)}
                            </span>
                            <span className="block text-xs text-ink-caption">
                              {place.kind === "city"
                                ? place.country
                                : place.country
                                  ? `${place.city} · ${place.country}`
                                  : place.city || place.name}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
