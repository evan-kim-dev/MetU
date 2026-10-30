"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type Ref,
} from "react";
import { Globe, Loader2, MapPin, Plane, Search, X } from "lucide-react";
import {
  formatPlaceDestination,
  formatPlaceFlightLabel,
  formatPlaceListSubtitle,
  formatPlaceListTitle,
  type PlaceItem,
} from "@/lib/places/autocomplete";
import { usePlaceAutocomplete } from "@/lib/places/usePlaceAutocomplete";
import {
  getContinentId,
  CONTINENT_LABELS,
  type ContinentId,
} from "@/lib/airports/data";

interface AirportSearchFieldProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  /** 목록에서 장소 선택 시 (자유 입력은 호출되지 않음) */
  onSelectPlace?: (place: PlaceItem) => void;
  /** 선택 시 값 포맷 (기본: mode별 PlaceItem 포맷) */
  formatValue?: (place: PlaceItem) => string;
  variant?: "default" | "compact";
  /**
   * all — 도시+공항(코드 포함, 항공권 체크리스트용)
   * cities — 도시·나라 (온보딩·빠른 여행)
   */
  placesMode?: "all" | "cities";
  inputRef?: Ref<HTMLInputElement>;
  inputId?: string;
  disabled?: boolean;
  maxLength?: number;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-describedby"?: string;
  onInputKeyDown?: (e: ReactKeyboardEvent<HTMLInputElement>) => void;
}

function groupLocalByContinent(
  places: PlaceItem[]
): Array<{ id: ContinentId | "flat"; label: string; places: PlaceItem[] }> {
  const buckets = new Map<ContinentId, PlaceItem[]>();
  for (const place of places) {
    const fake = {
      id: place.id,
      kind: "city" as const,
      name: place.name,
      city: place.name,
      country: place.countryName ?? "",
      keywords: [] as string[],
    };
    const id = getContinentId(fake);
    const list = buckets.get(id);
    if (list) list.push(place);
    else buckets.set(id, [place]);
  }
  const order: ContinentId[] = [
    "east-asia",
    "southeast-asia",
    "europe",
    "americas",
    "oceania",
    "middle-east",
    "other",
  ];
  return order
    .filter((id) => (buckets.get(id)?.length ?? 0) > 0)
    .map((id) => ({
      id,
      label: CONTINENT_LABELS[id],
      places: buckets.get(id) ?? [],
    }));
}

export function AirportSearchField({
  label,
  placeholder,
  value,
  onChange,
  onSelectPlace,
  formatValue,
  variant = "default",
  placesMode = "all",
  inputRef,
  inputId,
  disabled,
  maxLength,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  onInputKeyDown,
}: AirportSearchFieldProps) {
  const resolvedFormat =
    formatValue ??
    (placesMode === "cities" ? formatPlaceDestination : formatPlaceFlightLabel);
  const listId = useId();
  const autoId = useId();
  const fieldId = inputId ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery(value);
        setActiveIndex(-1);
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

  const { items, loading, source } = usePlaceAutocomplete(
    searchText,
    placesMode
  );

  const useGrouped =
    !searchText.trim() && (source === "local" || source === null);

  const groupedResults = useMemo(() => {
    if (!useGrouped) {
      return [{ id: "flat" as const, label: "", places: items }];
    }
    return groupLocalByContinent(items);
  }, [items, useGrouped]);

  const flatPlaces = useMemo(
    () => groupedResults.flatMap((g) => g.places),
    [groupedResults]
  );

  useEffect(() => {
    setActiveIndex(-1);
  }, [searchText, items]);

  const handleSelect = (place: PlaceItem) => {
    const next = resolvedFormat(place);
    onChange(next);
    onSelectPlace?.(place);
    setQuery(next);
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleFreeText = () => {
    const next = query.trim();
    if (!next) return;
    onChange(next);
    setQuery(next);
    setOpen(false);
    setActiveIndex(-1);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (e.key === "ArrowDown") {
        setOpen(true);
        e.preventDefault();
        return;
      }
      onInputKeyDown?.(e);
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setQuery(value);
      setActiveIndex(-1);
      return;
    }

    const freeTextOption =
      searchText.trim() && flatPlaces.length === 0 && !loading ? 1 : 0;
    const count = flatPlaces.length + freeTextOption;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (count === 0) return;
      setActiveIndex((i) => (i + 1) % count);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (count === 0) return;
      setActiveIndex((i) => (i <= 0 ? count - 1 : i - 1));
      return;
    }
    if (e.key === "Enter") {
      if (activeIndex >= 0 && activeIndex < flatPlaces.length) {
        e.preventDefault();
        const place = flatPlaces[activeIndex];
        if (place) handleSelect(place);
        return;
      }
      if (
        freeTextOption &&
        (activeIndex === flatPlaces.length || activeIndex < 0) &&
        searchText.trim()
      ) {
        // 결과 0개면 Enter로 자유 입력 확정
        if (flatPlaces.length === 0) {
          e.preventDefault();
          handleFreeText();
          return;
        }
      }
      onInputKeyDown?.(e);
      return;
    }

    onInputKeyDown?.(e);
  };

  const isCompact = variant === "compact";
  const activeOptionId =
    activeIndex >= 0 && activeIndex < flatPlaces.length
      ? `${listId}-opt-${activeIndex}`
      : activeIndex === flatPlaces.length && searchText.trim()
        ? `${listId}-free`
        : undefined;

  return (
    <div ref={rootRef} className="relative flex flex-col gap-1">
      <label
        htmlFor={fieldId}
        className={
          isCompact
            ? "text-xs font-semibold text-ink-caption"
            : "text-sm font-semibold text-ink-body"
        }
      >
        {label}
      </label>
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
            ref={inputRef}
            id={fieldId}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeOptionId}
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedBy}
            autoComplete="off"
            disabled={disabled}
            maxLength={maxLength}
            placeholder={placeholder}
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              onChange(e.target.value);
              setOpen(true);
            }}
            onKeyDown={onKeyDown}
            className={[
              "w-full min-w-0 flex-1 bg-transparent text-ink-heading placeholder:text-ink-caption/70 focus:outline-none disabled:opacity-60",
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
              className="flex h-11 w-11 items-center justify-center rounded-full text-ink-caption transition-colors active:bg-surface-soft"
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
          {flatPlaces.length === 0 && !loading ? (
            searchText.trim() ? (
              <li role="option" id={`${listId}-free`} aria-selected={activeIndex === 0}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleFreeText}
                  className={[
                    "flex min-h-11 w-full items-center px-4 py-2.5 text-left text-sm font-semibold text-brand transition-colors",
                    activeIndex === 0 ? "bg-brand/8" : "hover:bg-surface-soft",
                  ].join(" ")}
                >
                  ‘{searchText.trim()}’ 그대로 쓰기
                </button>
              </li>
            ) : (
              <li className="px-3 py-2.5 text-sm text-ink-caption">
                검색 결과가 없어요
              </li>
            )
          ) : (
            groupedResults.map((group) => (
              <li key={group.id} role="presentation">
                {group.label ? (
                  <div
                    className={[
                      "sticky top-0 z-[1] border-b border-line-soft/80 bg-surface-soft/95 py-1.5 text-[11px] font-bold tracking-wide text-ink-caption backdrop-blur-sm",
                      isCompact ? "px-2.5" : "px-4",
                    ].join(" ")}
                  >
                    {group.label}
                  </div>
                ) : null}
                <ul role="group" aria-label={group.label || "검색 결과"}>
                  {group.places.map((place) => {
                    const flatIdx = flatPlaces.indexOf(place);
                    const selected = value === resolvedFormat(place);
                    const active = flatIdx === activeIndex;
                    const title = formatPlaceListTitle(place, placesMode);
                    const subtitle = formatPlaceListSubtitle(place);
                    const Icon =
                      place.type === "country"
                        ? Globe
                        : place.type === "airport"
                          ? Plane
                          : MapPin;
                    return (
                      <li
                        key={place.id}
                        id={`${listId}-opt-${flatIdx}`}
                        role="option"
                        aria-selected={selected || active}
                      >
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleSelect(place)}
                          className={[
                            "flex min-h-11 w-full items-start gap-2.5 text-left transition-colors",
                            isCompact ? "px-3 py-2" : "gap-3 px-4 py-2.5",
                            selected || active
                              ? "bg-brand/8"
                              : "hover:bg-surface-soft active:bg-surface-soft",
                            place.type === "airport" && placesMode === "all"
                              ? isCompact
                                ? "pl-6"
                                : "pl-8"
                              : "",
                          ].join(" ")}
                        >
                          <span
                            className={[
                              "mt-0.5 flex shrink-0 items-center justify-center rounded-full",
                              isCompact ? "h-6 w-6" : "h-8 w-8",
                              place.type === "airport" && placesMode === "all"
                                ? "bg-surface-soft text-ink-caption"
                                : "bg-brand/10 text-brand",
                            ].join(" ")}
                          >
                            <Icon
                              className={isCompact ? "h-3 w-3" : "h-4 w-4"}
                              strokeWidth={2.2}
                            />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span
                              className={[
                                "block truncate font-bold text-ink-heading",
                                isCompact ? "text-xs" : "text-sm",
                              ].join(" ")}
                            >
                              {title}
                            </span>
                            {subtitle ? (
                              <span className="block text-xs text-ink-caption">
                                {subtitle}
                              </span>
                            ) : null}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))
          )}
          {loading ? (
            <li
              role="presentation"
              className="flex items-center justify-center gap-2 px-3 py-2 text-xs text-ink-caption"
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              검색 중…
            </li>
          ) : null}
        </ul>
      )}
    </div>
  );
}
