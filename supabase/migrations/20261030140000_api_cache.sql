-- Shared HTTP/JSON response cache for Next Route Handlers (service role only).
create table if not exists public.api_cache (
  key text primary key,
  value jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists api_cache_expires_at_idx
  on public.api_cache (expires_at);

alter table public.api_cache enable row level security;
-- No policies: service_role only (P1-A / P9 / P1-B insight cache).

comment on table public.api_cache is
  'Server-side response cache. Cleanup: delete from api_cache where expires_at < now() - interval ''7 days'';';
