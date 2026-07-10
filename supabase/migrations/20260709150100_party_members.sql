-- Party members (join/leave without post-owner-only update policy)

create table if not exists public.party_members (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id text not null,
  name text not null default '',
  avatar text not null default '🧑',
  joined_at timestamptz not null default now(),
  is_host boolean not null default false,
  primary key (post_id, user_id)
);

create index if not exists party_members_post_id_idx
  on public.party_members (post_id);

alter table public.party_members enable row level security;

create policy "party_members_select_all_auth"
  on public.party_members for select
  to authenticated
  using (true);

create policy "party_members_insert_own"
  on public.party_members for insert
  to authenticated
  with check (auth.uid()::text = user_id);

create policy "party_members_delete_own_non_host"
  on public.party_members for delete
  to authenticated
  using (auth.uid()::text = user_id and is_host = false);
