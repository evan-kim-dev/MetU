-- Core app tables: trips, community, onboarding plans, budget insights

-- ---------------------------------------------------------------------------
-- Trips
-- ---------------------------------------------------------------------------
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  destination text not null default '',
  country text not null default '',
  origin text not null default '',
  date_range text not null default '',
  d_day integer not null default 0,
  budget numeric not null default 0,
  spent numeric not null default 0,
  people integer not null default 1,
  styles jsonb not null default '[]'::jsonb,
  image_url text not null default '',
  memo text,
  status text not null default 'upcoming'
    check (status in ('upcoming', 'ongoing', 'completed')),
  budget_allocation jsonb not null default '[]'::jsonb,
  daily_schedule jsonb not null default '[]'::jsonb,
  tips jsonb not null default '[]'::jsonb,
  expenses jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trips_user_id_created_at_idx
  on public.trips (user_id, created_at desc);

alter table public.trips enable row level security;

create policy "trips_select_own"
  on public.trips for select
  using (auth.uid() = user_id);

create policy "trips_insert_own"
  on public.trips for insert
  with check (auth.uid() = user_id);

create policy "trips_update_own"
  on public.trips for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "trips_delete_own"
  on public.trips for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Community posts (땡팅 / 게시판)
-- ---------------------------------------------------------------------------
create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id text not null,
  author_name text not null default '',
  author_avatar text not null default '✈️',
  category text not null
    check (category in ('party', 'question', 'review', 'tip')),
  destination text not null default '',
  title text not null default '',
  body text not null default '',
  party_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists community_posts_created_at_idx
  on public.community_posts (created_at desc);

create index if not exists community_posts_category_idx
  on public.community_posts (category);

alter table public.community_posts enable row level security;

create policy "community_posts_select_all_auth"
  on public.community_posts for select
  to authenticated
  using (true);

create policy "community_posts_insert_auth"
  on public.community_posts for insert
  to authenticated
  with check (auth.uid()::text = author_id);

create policy "community_posts_update_own"
  on public.community_posts for update
  to authenticated
  using (auth.uid()::text = author_id)
  with check (auth.uid()::text = author_id);

create policy "community_posts_delete_own"
  on public.community_posts for delete
  to authenticated
  using (auth.uid()::text = author_id);

-- ---------------------------------------------------------------------------
-- Post comments
-- ---------------------------------------------------------------------------
create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_id text not null,
  author_name text not null default '',
  author_avatar text not null default '💬',
  content text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists post_comments_post_id_idx
  on public.post_comments (post_id, created_at asc);

alter table public.post_comments enable row level security;

create policy "post_comments_select_all_auth"
  on public.post_comments for select
  to authenticated
  using (true);

create policy "post_comments_insert_auth"
  on public.post_comments for insert
  to authenticated
  with check (auth.uid()::text = author_id);

create policy "post_comments_update_own"
  on public.post_comments for update
  to authenticated
  using (auth.uid()::text = author_id)
  with check (auth.uid()::text = author_id);

create policy "post_comments_delete_own"
  on public.post_comments for delete
  to authenticated
  using (auth.uid()::text = author_id);

-- ---------------------------------------------------------------------------
-- Post likes
-- ---------------------------------------------------------------------------
create table if not exists public.post_likes (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id text not null,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.post_likes enable row level security;

create policy "post_likes_select_all_auth"
  on public.post_likes for select
  to authenticated
  using (true);

create policy "post_likes_insert_own"
  on public.post_likes for insert
  to authenticated
  with check (auth.uid()::text = user_id);

create policy "post_likes_delete_own"
  on public.post_likes for delete
  to authenticated
  using (auth.uid()::text = user_id);

-- ---------------------------------------------------------------------------
-- Onboarding / trip plans
-- ---------------------------------------------------------------------------
create table if not exists public.trip_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  form_data jsonb not null default '{}'::jsonb,
  plan_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists trip_plans_user_id_created_at_idx
  on public.trip_plans (user_id, created_at desc);

alter table public.trip_plans enable row level security;

create policy "trip_plans_select_own"
  on public.trip_plans for select
  using (auth.uid() = user_id);

create policy "trip_plans_insert_own"
  on public.trip_plans for insert
  with check (auth.uid() = user_id);

create policy "trip_plans_delete_own"
  on public.trip_plans for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Budget insight logs (AI + RAG)
-- ---------------------------------------------------------------------------
create table if not exists public.budget_insight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  budget integer not null default 0,
  month integer not null default 0,
  source text not null default 'unknown',
  insight text not null default '',
  local_fallback text not null default '',
  rag_band_id text not null default '',
  allowed_regions jsonb not null default '[]'::jsonb,
  rag_contexts jsonb not null default '[]'::jsonb,
  season_tip text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists budget_insight_logs_created_at_idx
  on public.budget_insight_logs (created_at desc);

alter table public.budget_insight_logs enable row level security;

create policy "budget_insight_logs_select_own"
  on public.budget_insight_logs for select
  using (auth.uid() = user_id);

create policy "budget_insight_logs_insert_own"
  on public.budget_insight_logs for insert
  with check (user_id is null or auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trips_updated_at on public.trips;
create trigger trips_updated_at
  before update on public.trips
  for each row execute function public.set_updated_at();

drop trigger if exists community_posts_updated_at on public.community_posts;
create trigger community_posts_updated_at
  before update on public.community_posts
  for each row execute function public.set_updated_at();
