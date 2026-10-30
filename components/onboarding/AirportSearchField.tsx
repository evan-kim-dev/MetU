"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type Ref,
} from "react";
import { Globe, MapPin, Plane, Search, X } from "lucide-react";
import {
  formatCityCountryLabel,
  formatPlaceLabel,
  groupPlacesByContinent,
  type AirportPlace,
} from "@/lib/airports/data";
import {
  searchPlaces,
  type PlaceResult,
} from "@/lib/airports/search";

interface AirportSearchFieldProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  /** 목록에서 장소를 고르면 호출 (자유 입력·타이핑 중에는 null) */
  onPlaceSelect?: (place: AirportPlace | null) => void;
  /** 선택 시 값 포맷 (기본: place.name) */
  formatValue?: (place: AirportPlace) => string;
  variant?: "default" | "compact";
  /**
   * all — 도시+공항(코드 포함, 항공권 체크리스트용)
   * cities — 도시·나라만 (온보딩용, IATA 숨김)
   */
  placesMode?: "all" | "cities";
  maxLength?: number;
  disabled?: boolean;
  inputId?: string;
  inputRef?: Ref<HTMLInputElement>;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  /** 드롭다운이 닫혀 있거나 활성 항목이 없을 때 Enter 등 전달 */
  onInputKeyDown?: (e: ReactKeyboardEvent<HTMLInputElement>) => void;
}

function highlightMatch(text: string, query: string): ReactNode {
  const q = query.trim();
  if (!q || !text) return text;
  const lowerText = text.toLocaleLowerCase("ko-KR");
  const lowerQ = q.toLocaleLowerCase("ko-KR");
  const idx = lowerText.indexOf(lowerQ);
  if (idx < 0) return text;
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + q.length);
  const after = text.slice(idx + q.length);
  return (
    <>
      {before}
      <mark className="bg-transparent font-extrabold text-brand">{match}</mark>
      {after}
    </>
  );
}

function KindIcon({
  kind,
  compact,
}: {
  kind: AirportPlace["kind"];
  compact: boolean;
}) {
  const size = compact ? "h-3 w-3" : "h-4 w-4";
  if (kind === "country") {
    return <Globe className={size} strokeWidth={2.2} />;
  }
  if (kind === "airport") {
    return <Plane className={size} strokeWidth={2.2} />;
  }
  return <MapPin className={size} strokeWidth={2.2} />;
}

export function AirportSearchField({
  label,
  placeholder,
  value,
  onChange,
  onPlaceSelect,
  formatValue,
  variant = "default",
  placesMode = "all",
  maxLength,
  disabled,
  inputId: inputIdProp,
  inputRef,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  onInputKeyDown,
}: AirportSearchFieldProps) {
  const resolvedFormat =
    formatValue ??
    (placesMode === "cities" ? formatCityCountryLabel : formatPlaceLabel);
  const listId = useId();
  const autoInputId = useId();
  const inputId = inputIdProp ?? autoInputId;
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

  const placeResults: PlaceResult[] = useMemo(() => {
    return searchPlaces(searchText, { mode: placesMode, limit: 40 });
  }, [placesMode, searchText]);

  const results = useMemo(
    () => placeResults.map((r) => r.place),
    [placeResults]
  );

  const resultById = useMemo(() => {
    const map = new Map<string, PlaceResult>();
    for (const r of placeResults) map.set(r.place.id, r);
    return map;
  }, [placeResults]);

  const groupedResults = useMemo(
    () => groupPlacesByContinent(results),
    [results]
  );

  const flatOptions = useMemo(() => {
    const list: AirportPlace[] = [];
    for (const group of groupedResults) {
      for (const place of group.places) list.push(place);
    }
    return list;
  }, [groupedResults]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [searchText, open]);

  const handleSelect = (place: AirportPlace) => {
    const next = resolvedFormat(place);
    onChange(next);
    onPlaceSelect?.(place);
    setQuery(next);
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleFreeText = () => {
    const next = query.trim();
    onChange(next);
    onPlaceSelect?.(null);
    setQuery(next);
    setOpen(false);
    setActiveIndex(-1);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      onInputKeyDown?.(e);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (flatOptions.length === 0) return;
      setActiveIndex((i) => (i + 1) % flatOptions.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (flatOptions.length === 0) return;
      setActiveIndex((i) => (i <= 0 ? flatOptions.length - 1 : i - 1));
      return;
    }
    if (e.key === "Enter") {
      if (activeIndex >= 0 && flatOptions[activeIndex]) {
        e.preventDefault();
        handleSelect(flatOptions[activeIndex]!);
        return;
      }
      if (results.length === 0 && query.trim()) {
        e.preventDefault();
        handleFreeText();
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
    onInputKeyDown?.(e);
  };

  const isCompact = variant === "compact";
  const citiesOnly = placesMode === "cities";
  const activeOptionId =
    activeIndex >= 0 && flatOptions[activeIndex]
      ? `${listId}-opt-${flatOptions[activeIndex]!.id}`
      : undefined;

  const highlightQ = searchText.trim();

  return (
    <div ref={rootRef} className="relative flex flex-col gap-1">
      <label
        htmlFor={inputId}
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
            disabled ? "opacity-60" : "",
          ].join(" ")}
        >
          {!isCompact ? (
            <Search className="h-4 w-4 shrink-0 text-ink-caption" strokeWidth={2.2} />
          ) : null}
          <input
            ref={inputRef}
            id={inputId}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeOptionId}
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedBy}
            autoComplete="off"
            placeholder={placeholder}
            value={query}
            maxLength={maxLength}
            disabled={disabled}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              onChange(e.target.value);
              onPlaceSelect?.(null);
              setOpen(true);
            }}
            onKeyDown={onKeyDown}
            className={[
              "w-full min-w-0 flex-1 bg-transparent text-ink-heading placeholder:text-ink-caption/70 focus:outline-none",
              isCompact ? "text-sm" : "py-3.5 text-base",
            ].join(" ")}
          />
          {query && !isCompact && !disabled ? (
            <button
              type="button"
              aria-label="입력 지우기"
              onClick={() => {
                setQuery("");
                onChange("");
                onPlaceSelect?.(null);
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
            query.trim() ? (
              <li role="option" aria-selected={false} className="px-1 py-1">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleFreeText}
                  className={[
                    "flex w-full min-h-11 items-center px-3 text-left text-sm font-semibold text-brand transition-colors hover:bg-surface-soft active:bg-surface-soft",
                    isCompact ? "rounded-md" : "rounded-xl px-4",
                  ].join(" ")}
                >
                  ‘{query.trim()}’ 그대로 쓰기
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
                    const meta = resultById.get(place.id);
                    const isAirport = place.kind === "airport";
                    const isCountry = place.kind === "country";
                    const selected = value === resolvedFormat(place);
                    const flatIdx = flatOptions.findIndex((p) => p.id === place.id);
                    const isActive = flatIdx === activeIndex;
                    const title = citiesOnly
                      ? isCountry
                        ? place.name
                        : place.city
                      : resolvedFormat(place);
                    let subtitle: ReactNode;
                    if (citiesOnly) {
                      if (meta?.matchedOn === "code" && meta.matchedCode) {
                        subtitle = (
                          <>
                            {place.country} ·{" "}
                            <span className="font-bold">{meta.matchedCode}</span>
                            로 찾음
                          </>
                        );
                      } else if (isCountry) {
                        subtitle = "나라 전체";
                      } else {
                        subtitle = place.country;
                      }
                    } else if (place.kind === "city" || place.kind === "country") {
                      subtitle = place.country;
                    } else {
                      subtitle = place.country
                        ? `${place.city} · ${place.country}`
                        : place.city || place.name;
                    }
                    const optionId = `${listId}-opt-${place.id}`;
                    return (
                      <li
                        key={place.id}
                        id={optionId}
                        role="option"
                        aria-selected={selected || isActive}
                      >
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleSelect(place)}
                          onMouseEnter={() => setActiveIndex(flatIdx)}
                          className={[
                            "flex w-full min-h-11 items-start gap-2.5 text-left transition-colors",
                            isCompact ? "px-3 py-2" : "gap-3 px-4 py-2.5",
                            selected || isActive
                              ? "bg-brand/8"
                              : "hover:bg-surface-soft active:bg-surface-soft",
                            isAirport && !citiesOnly
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
                              isAirport && !citiesOnly
                                ? "bg-surface-soft text-ink-caption"
                                : "bg-brand/10 text-brand",
                            ].join(" ")}
                          >
                            <KindIcon kind={place.kind} compact={isCompact} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span
                              className={[
                                "block truncate font-bold text-ink-heading",
                                isCompact ? "text-xs" : "text-sm",
                              ].join(" ")}
                            >
                              {highlightMatch(title, highlightQ)}
                            </span>
                            <span className="block text-xs text-ink-caption">
                              {subtitle}
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
