-- Phase 8: 여행 MetU 봇 제안. 장부 확정 전 확인함 대기열.
-- 메시지가 곧 지출이 되지 않음. 호스트 승인 후에만 후속(분담 미리보기 등).

create table if not exists public.trip_bot_proposals (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  kind text not null
    check (kind in ('split', 'schedule', 'clarify')),
  user_text text not null
    check (char_length(trim(user_text)) > 0 and char_length(user_text) <= 500),
  assistant_text text not null
    check (char_length(trim(assistant_text)) > 0 and char_length(assistant_text) <= 2000),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists trip_bot_proposals_trip_status_idx
  on public.trip_bot_proposals (trip_id, status, created_at desc);

alter table public.trip_bot_proposals enable row level security;

-- 멤버만 읽기
drop policy if exists "trip_bot_proposals_select" on public.trip_bot_proposals;
create policy "trip_bot_proposals_select"
  on public.trip_bot_proposals for select
  using (
    exists (
      select 1 from public.trip_members m
      where m.trip_id = trip_bot_proposals.trip_id
        and m.user_id = auth.uid()
    )
  );

-- 멤버가 자기 제안 insert
drop policy if exists "trip_bot_proposals_insert" on public.trip_bot_proposals;
create policy "trip_bot_proposals_insert"
  on public.trip_bot_proposals for insert
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.trip_members m
      where m.trip_id = trip_bot_proposals.trip_id
        and m.user_id = auth.uid()
    )
  );

-- 호스트(trips.user_id)만 status 결정
drop policy if exists "trip_bot_proposals_update_host" on public.trip_bot_proposals;
create policy "trip_bot_proposals_update_host"
  on public.trip_bot_proposals for update
  using (
    exists (
      select 1 from public.trips t
      where t.id = trip_bot_proposals.trip_id
        and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.trips t
      where t.id = trip_bot_proposals.trip_id
        and t.user_id = auth.uid()
    )
  );

grant select, insert, update on public.trip_bot_proposals to authenticated;
