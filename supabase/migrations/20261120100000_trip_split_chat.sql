-- 분담 실시간 대화방 (여행당 1 스레드 + 메시지)
-- Additive only. 기존 마이그레이션은 수정하지 않는다.

-- ---------------------------------------------------------------------------
-- 1) threads: trip 당 1방
-- ---------------------------------------------------------------------------
create table if not exists public.trip_split_threads (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint trip_split_threads_trip_unique unique (trip_id)
);

create index if not exists trip_split_threads_trip_idx
  on public.trip_split_threads (trip_id);

alter table public.trip_split_threads enable row level security;

drop policy if exists "trip_split_threads_select_member" on public.trip_split_threads;
create policy "trip_split_threads_select_member"
  on public.trip_split_threads for select
  to authenticated
  using (public.is_trip_member(trip_id));

-- 멤버가 ensure 할 수 있게 insert 허용 (trip 당 unique 로 중복 방지)
drop policy if exists "trip_split_threads_insert_member" on public.trip_split_threads;
create policy "trip_split_threads_insert_member"
  on public.trip_split_threads for insert
  to authenticated
  with check (public.is_trip_member(trip_id));

-- ---------------------------------------------------------------------------
-- 2) messages
-- ---------------------------------------------------------------------------
create table if not exists public.trip_split_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.trip_split_threads(id) on delete cascade,
  sender_kind text not null
    check (sender_kind in ('user', 'agent', 'system')),
  sender_user_id uuid references public.profiles(id) on delete set null,
  body text not null
    check (char_length(trim(body)) > 0 and char_length(body) <= 2000),
  payload jsonb null,
  created_at timestamptz not null default now(),
  constraint trip_split_messages_user_sender_check check (
    (sender_kind = 'user' and sender_user_id is not null)
    or (sender_kind in ('agent', 'system'))
  )
);

create index if not exists trip_split_messages_thread_created_idx
  on public.trip_split_messages (thread_id, created_at asc);

alter table public.trip_split_messages enable row level security;

drop policy if exists "trip_split_messages_select_member" on public.trip_split_messages;
create policy "trip_split_messages_select_member"
  on public.trip_split_messages for select
  to authenticated
  using (
    exists (
      select 1
      from public.trip_split_threads t
      where t.id = trip_split_messages.thread_id
        and public.is_trip_member(t.trip_id)
    )
  );

-- 사용자 메시지만 멤버가 직접 insert (본인 sender)
drop policy if exists "trip_split_messages_insert_user" on public.trip_split_messages;
create policy "trip_split_messages_insert_user"
  on public.trip_split_messages for insert
  to authenticated
  with check (
    sender_kind = 'user'
    and sender_user_id = (select auth.uid())
    and exists (
      select 1
      from public.trip_split_threads t
      where t.id = trip_split_messages.thread_id
        and public.is_trip_member(t.trip_id)
    )
  );

-- agent / system insert 는 service_role 만 (RLS bypass). 정책 없음.

-- ---------------------------------------------------------------------------
-- 3) Realtime
-- ---------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.trip_split_messages;
exception
  when duplicate_object then null;
end $$;
