-- Places cache: Kakao Local / Google Places (New) 검색 결과 캐시
-- opening_hours IS NULL → 영업시간 미상 (별도 hours_known 컬럼 없음)

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('kakao', 'google')),
  provider_place_id text not null,
  name text not null,
  lat double precision not null,
  lng double precision not null,
  address text,
  kind text not null default 'other',
  types text[] not null default '{}',
  rating numeric(2, 1) null,
  user_rating_count int null,
  price_level text null,
  opening_hours jsonb null,
  utc_offset_minutes int null,
  maps_uri text,
  phone text,
  category_name text,
  city text not null,
  country_code text,
  fetched_at timestamptz not null default now(),
  unique (provider, provider_place_id)
);

comment on column public.places.opening_hours is
  'NULL means opening hours unknown (e.g. Kakao). Non-null JSON is OpeningPeriod[].';

create index if not exists places_city_kind_idx
  on public.places (city, kind);

create index if not exists places_lat_lng_idx
  on public.places (lat, lng);

create index if not exists places_provider_idx
  on public.places (provider);

alter table public.places enable row level security;

create policy "places_select_authenticated"
  on public.places for select
  to authenticated
  using (true);

-- insert/update/delete: 서비스 롤만 (정책 없음)
