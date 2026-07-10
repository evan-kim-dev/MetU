export interface WeatherDay {
  date: string;
  label: string;
  maxC: number;
  minC: number;
  description: string;
}

export interface WeatherForecast {
  place: string;
  currentTempC: number;
  currentDescription: string;
  days: WeatherDay[];
}

interface GeoResult {
  name: string;
  country?: string;
  latitude: number;
  longitude: number;
}

function weatherCodeLabel(code: number): string {
  if (code === 0) return "맑음";
  if (code <= 3) return "구름 조금";
  if (code <= 48) return "안개";
  if (code <= 57) return "이슬비";
  if (code <= 67) return "비";
  if (code <= 77) return "눈";
  if (code <= 82) return "소나기";
  if (code <= 86) return "눈";
  if (code >= 95) return "천둥번개";
  return "변덕스러운 날씨";
}

function formatDayLabel(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString("ko-KR", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });
}

export type TripWeatherSource = "forecast" | "climate";

export interface TripWeatherDay extends WeatherDay {
  source: TripWeatherSource;
}

async function geocodePlace(query: string): Promise<GeoResult | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const geoRes = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trimmed)}&count=1&language=ko&format=json`
  );
  if (!geoRes.ok) return null;

  const geoJson = (await geoRes.json()) as { results?: GeoResult[] };
  return geoJson.results?.[0] ?? null;
}

function toIsoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysUntil(isoDate: string): number {
  const target = new Date(`${isoDate}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

interface DayClimateStats {
  avgMax: number;
  avgMin: number;
  avgPrecip: number;
  dominantCode: number;
}

function describeMonthlyClimate(stats: DayClimateStats): string {
  if (stats.avgPrecip >= 8) return "비 자주 옴";
  if (stats.avgPrecip >= 4) return "소나기 가능";
  if (stats.avgPrecip >= 1.5) return "이슬비 가능";
  return weatherCodeLabel(stats.dominantCode);
}

function dominantWeatherCode(codes: number[]): number {
  if (codes.length === 0) return 0;
  const counts = new Map<number, number>();
  for (const code of codes) {
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

const CLIMATE_YEARS_BACK = 5;

async function fetchMonthlyClimateProfile(
  latitude: number,
  longitude: number,
  month: number
): Promise<{ byDay: Map<number, DayClimateStats>; monthAverage: DayClimateStats } | null> {
  const currentYear = new Date().getFullYear();
  const startYear = currentYear - CLIMATE_YEARS_BACK;
  const endYear = currentYear - 1;
  const startDate = toIsoDate(startYear, month, 1);
  const endDate = toIsoDate(endYear, month, lastDayOfMonth(endYear, month));

  const archiveUrl = new URL("https://archive-api.open-meteo.com/v1/archive");
  archiveUrl.searchParams.set("latitude", String(latitude));
  archiveUrl.searchParams.set("longitude", String(longitude));
  archiveUrl.searchParams.set("start_date", startDate);
  archiveUrl.searchParams.set("end_date", endDate);
  archiveUrl.searchParams.set(
    "daily",
    "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum"
  );
  archiveUrl.searchParams.set("timezone", "auto");

  const archiveRes = await fetch(archiveUrl.toString());
  if (!archiveRes.ok) return null;

  const archiveJson = (await archiveRes.json()) as {
    daily?: {
      time?: string[];
      weather_code?: number[];
      temperature_2m_max?: number[];
      temperature_2m_min?: number[];
      precipitation_sum?: number[];
    };
  };

  const times = archiveJson.daily?.time ?? [];
  const buckets = new Map<
    number,
    { maxes: number[]; mins: number[]; precips: number[]; codes: number[] }
  >();

  times.forEach((date, index) => {
    const [, monthPart, dayPart] = date.split("-").map(Number);
    if (monthPart !== month) return;

    const max = archiveJson.daily?.temperature_2m_max?.[index];
    const min = archiveJson.daily?.temperature_2m_min?.[index];
    if (max == null || min == null) return;

    const day = dayPart;
    const bucket = buckets.get(day) ?? {
      maxes: [],
      mins: [],
      precips: [],
      codes: [],
    };
    bucket.maxes.push(max);
    bucket.mins.push(min);
    bucket.precips.push(archiveJson.daily?.precipitation_sum?.[index] ?? 0);
    bucket.codes.push(archiveJson.daily?.weather_code?.[index] ?? 0);
    buckets.set(day, bucket);
  });

  if (buckets.size === 0) return null;

  const byDay = new Map<number, DayClimateStats>();
  const monthMaxes: number[] = [];
  const monthMins: number[] = [];
  const monthPrecips: number[] = [];
  const monthCodes: number[] = [];

  for (const [day, bucket] of buckets) {
    const stats: DayClimateStats = {
      avgMax: Math.round(
        bucket.maxes.reduce((sum, value) => sum + value, 0) / bucket.maxes.length
      ),
      avgMin: Math.round(
        bucket.mins.reduce((sum, value) => sum + value, 0) / bucket.mins.length
      ),
      avgPrecip:
        bucket.precips.reduce((sum, value) => sum + value, 0) /
        bucket.precips.length,
      dominantCode: dominantWeatherCode(bucket.codes),
    };
    byDay.set(day, stats);
    monthMaxes.push(...bucket.maxes);
    monthMins.push(...bucket.mins);
    monthPrecips.push(...bucket.precips);
    monthCodes.push(...bucket.codes);
  }

  const monthAverage: DayClimateStats = {
    avgMax: Math.round(
      monthMaxes.reduce((sum, value) => sum + value, 0) / monthMaxes.length
    ),
    avgMin: Math.round(
      monthMins.reduce((sum, value) => sum + value, 0) / monthMins.length
    ),
    avgPrecip:
      monthPrecips.reduce((sum, value) => sum + value, 0) / monthPrecips.length,
    dominantCode: dominantWeatherCode(monthCodes),
  };

  return { byDay, monthAverage };
}

function buildClimateDaysFromProfile(
  targetDates: string[],
  profile: { byDay: Map<number, DayClimateStats>; monthAverage: DayClimateStats },
  month: number
): TripWeatherDay[] {
  return targetDates.map((date) => {
    const dayOfMonth = Number(date.slice(8, 10));
    const dateMonth = Number(date.slice(5, 7));
    const stats =
      dateMonth === month
        ? profile.byDay.get(dayOfMonth) ?? profile.monthAverage
        : profile.monthAverage;

    return {
      date,
      label: formatDayLabel(date),
      maxC: stats.avgMax,
      minC: stats.avgMin,
      description: describeMonthlyClimate(stats),
      source: "climate" as const,
    };
  });
}

export async function fetchTripPeriodWeather(
  query: string,
  startDate: string,
  endDate: string
): Promise<{ place: string; days: TripWeatherDay[] } | null> {
  const place = await geocodePlace(query);
  if (!place) return null;

  const targetDates = enumerateTargetDates(startDate, endDate);
  if (targetDates.length === 0) return null;

  const untilStart = daysUntil(startDate);
  const useForecast = untilStart >= 0 && untilStart <= 15;

  if (useForecast) {
    const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast");
    forecastUrl.searchParams.set("latitude", String(place.latitude));
    forecastUrl.searchParams.set("longitude", String(place.longitude));
    forecastUrl.searchParams.set(
      "daily",
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max"
    );
    forecastUrl.searchParams.set("timezone", "auto");
    forecastUrl.searchParams.set(
      "forecast_days",
      String(Math.min(16, untilStart + targetDates.length + 1))
    );

    const forecastRes = await fetch(forecastUrl.toString());
    if (!forecastRes.ok) return null;

    const forecastJson = (await forecastRes.json()) as {
      daily?: {
        time?: string[];
        weather_code?: number[];
        temperature_2m_max?: number[];
        temperature_2m_min?: number[];
        precipitation_probability_max?: number[];
      };
    };

    const times = forecastJson.daily?.time ?? [];
    const dayMap = new Map<string, TripWeatherDay>();
    times.forEach((date, index) => {
      dayMap.set(date, {
        date,
        label: formatDayLabel(date),
        maxC: Math.round(forecastJson.daily?.temperature_2m_max?.[index] ?? 0),
        minC: Math.round(forecastJson.daily?.temperature_2m_min?.[index] ?? 0),
        description: weatherCodeLabel(
          forecastJson.daily?.weather_code?.[index] ?? 0
        ),
        source: "forecast",
      });
    });

    const days = targetDates
      .map((date) => dayMap.get(date))
      .filter((day): day is TripWeatherDay => Boolean(day));

    if (days.length > 0) {
      return {
        place: place.country ? `${place.name}, ${place.country}` : place.name,
        days,
      };
    }
  }

  const travelMonth = Number(startDate.slice(5, 7));
  const climateProfile = await fetchMonthlyClimateProfile(
    place.latitude,
    place.longitude,
    travelMonth
  );

  if (!climateProfile) return null;

  const days = buildClimateDaysFromProfile(
    targetDates,
    climateProfile,
    travelMonth
  );

  return {
    place: place.country ? `${place.name}, ${place.country}` : place.name,
    days,
  };
}

function enumerateTargetDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  let cursor = startDate;
  while (cursor <= endDate) {
    dates.push(cursor);
    const next = new Date(`${cursor}T12:00:00`);
    next.setDate(next.getDate() + 1);
    cursor = next.toISOString().slice(0, 10);
  }
  return dates;
}

export async function fetchWeatherForecast(
  query: string
): Promise<WeatherForecast | null> {
  const place = await geocodePlace(query);
  if (!place) return null;

  const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast");
  forecastUrl.searchParams.set("latitude", String(place.latitude));
  forecastUrl.searchParams.set("longitude", String(place.longitude));
  forecastUrl.searchParams.set("current", "temperature_2m,weather_code");
  forecastUrl.searchParams.set(
    "daily",
    "weather_code,temperature_2m_max,temperature_2m_min"
  );
  forecastUrl.searchParams.set("timezone", "auto");
  forecastUrl.searchParams.set("forecast_days", "5");

  const forecastRes = await fetch(forecastUrl.toString());
  if (!forecastRes.ok) return null;

  const forecastJson = (await forecastRes.json()) as {
    current?: { temperature_2m?: number; weather_code?: number };
    daily?: {
      time?: string[];
      weather_code?: number[];
      temperature_2m_max?: number[];
      temperature_2m_min?: number[];
    };
  };

  const currentCode = forecastJson.current?.weather_code ?? 0;
  const times = forecastJson.daily?.time ?? [];
  const days = times.map((date, index) => ({
    date,
    label: formatDayLabel(date),
    maxC: Math.round(forecastJson.daily?.temperature_2m_max?.[index] ?? 0),
    minC: Math.round(forecastJson.daily?.temperature_2m_min?.[index] ?? 0),
    description: weatherCodeLabel(forecastJson.daily?.weather_code?.[index] ?? 0),
  }));

  return {
    place: place.country ? `${place.name}, ${place.country}` : place.name,
    currentTempC: Math.round(forecastJson.current?.temperature_2m ?? 0),
    currentDescription: weatherCodeLabel(currentCode),
    days,
  };
}
