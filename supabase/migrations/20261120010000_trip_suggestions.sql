-- Budget-first: 에이전트는 데이터를 직접 바꾸지 않고 Suggestion 만 만든다.
-- accept 시에만 서버가 지출/일정/정산을 반영한다.

create table if not exists public.trip_suggestions (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  type text not null
    check (type in ('record', 'rebalance', 'settle')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'open'
    check (status in ('open', 'accepted', 'dismissed')),
  created_by uuid references auth.users (id) on delete set null,
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists trip_suggestions_trip_status_idx
  on public.trip_suggestions (trip_id, status, created_at desc);

create index if not exists trip_suggestions_trip_type_open_idx
  on public.trip_suggestions (trip_id, type)
  where status = 'open';

alter table public.trip_suggestions enable row level security;

-- 멤버 읽기
drop policy if exists "trip_suggestions_select" on public.trip_suggestions;
create policy "trip_suggestions_select"
  on public.trip_suggestions for select
  using (
    exists (
      select 1 from public.trip_members m
      where m.trip_id = trip_suggestions.trip_id
        and m.user_id = auth.uid()
    )
  );

-- 호스트만 status 결정 (수락/거절)
drop policy if exists "trip_suggestions_update_host" on public.trip_suggestions;
create policy "trip_suggestions_update_host"
  on public.trip_suggestions for update
  using (
    exists (
      select 1 from public.trips t
      where t.id = trip_suggestions.trip_id
        and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.trips t
      where t.id = trip_suggestions.trip_id
        and t.user_id = auth.uid()
    )
  );

-- insert 는 service_role RPC 전용 (클라이언트 직접 insert 금지)
revoke insert on public.trip_suggestions from authenticated, anon;
grant select, update on public.trip_suggestions to authenticated;

-- 에이전트 전용 insert (멤버십 검증)
create or replace function public.agent_create_suggestion(
  p_actor uuid,
  p_trip_id uuid,
  p_type text,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_type not in ('record', 'rebalance', 'settle') then
    raise exception 'invalid-suggestion-type';
  end if;

  if not exists (
    select 1 from public.trip_members m
    where m.trip_id = p_trip_id and m.user_id = p_actor
  ) and not exists (
    select 1 from public.trips t
    where t.id = p_trip_id and t.user_id = p_actor
  ) then
    raise exception 'not-a-member';
  end if;

  insert into public.trip_suggestions (trip_id, type, payload, status, created_by)
  values (p_trip_id, p_type, coalesce(p_payload, '{}'::jsonb), 'open', p_actor)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.agent_create_suggestion(uuid, uuid, text, jsonb) from public;
grant execute on function public.agent_create_suggestion(uuid, uuid, text, jsonb) to service_role;
