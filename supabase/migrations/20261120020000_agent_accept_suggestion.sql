-- Budget-first: Suggestion 수락/거절을 service_role RPC 한 트랜잭션으로.
-- 클라이언트는 trip_suggestions 를 직접 update 하지 못한다 (payload 조작 방지).

revoke update on public.trip_suggestions from authenticated, anon;
grant select on public.trip_suggestions to authenticated;

drop policy if exists "trip_suggestions_update_host" on public.trip_suggestions;

-- settle 수락: claim + settlement 생성 (basis/transfers 는 서버 TS 가 재계산해 전달)
create or replace function public.agent_accept_settle_suggestion(
  p_actor uuid,
  p_suggestion_id uuid,
  p_basis_hash text,
  p_transfers jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip uuid;
  v_status text;
  v_type text;
  v_settlement uuid;
begin
  if p_actor is null then
    raise exception 'actor-required';
  end if;

  select s.trip_id, s.status, s.type
    into v_trip, v_status, v_type
  from public.trip_suggestions s
  where s.id = p_suggestion_id
  for update;

  if v_trip is null then
    raise exception 'not-found';
  end if;
  if v_status <> 'open' then
    raise exception 'not-open';
  end if;
  if v_type <> 'settle' then
    raise exception 'wrong-type';
  end if;
  if not exists (
    select 1 from public.trips t where t.id = v_trip and t.user_id = p_actor
  ) then
    raise exception 'forbidden';
  end if;

  v_settlement := public.agent_create_settlement(
    p_actor,
    v_trip,
    'manual',
    p_basis_hash,
    p_transfers
  );

  update public.trip_suggestions
  set
    status = 'accepted',
    decided_by = p_actor,
    decided_at = now()
  where id = p_suggestion_id
    and status = 'open';

  if not found then
    raise exception 'not-open';
  end if;

  return v_settlement;
end;
$$;

-- rebalance 수락: claim + daily_schedule 패치 (스케줄 JSON 은 서버 TS 가 만든 값)
create or replace function public.agent_accept_rebalance_suggestion(
  p_actor uuid,
  p_suggestion_id uuid,
  p_daily_schedule jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip uuid;
  v_status text;
  v_type text;
begin
  if p_actor is null then
    raise exception 'actor-required';
  end if;

  select s.trip_id, s.status, s.type
    into v_trip, v_status, v_type
  from public.trip_suggestions s
  where s.id = p_suggestion_id
  for update;

  if v_trip is null then
    raise exception 'not-found';
  end if;
  if v_status <> 'open' then
    raise exception 'not-open';
  end if;
  if v_type <> 'rebalance' then
    raise exception 'wrong-type';
  end if;
  if not exists (
    select 1 from public.trips t where t.id = v_trip and t.user_id = p_actor
  ) then
    raise exception 'forbidden';
  end if;

  update public.trips
  set daily_schedule = coalesce(p_daily_schedule, '[]'::jsonb)
  where id = v_trip;

  update public.trip_suggestions
  set
    status = 'accepted',
    decided_by = p_actor,
    decided_at = now()
  where id = p_suggestion_id
    and status = 'open';

  if not found then
    raise exception 'not-open';
  end if;

  return p_suggestion_id;
end;
$$;

-- record 등: 이미 부수 효과(confirm) 후 status 만 원자적으로 accepted
create or replace function public.agent_mark_suggestion_accepted(
  p_actor uuid,
  p_suggestion_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip uuid;
  v_status text;
begin
  if p_actor is null then
    raise exception 'actor-required';
  end if;

  select s.trip_id, s.status
    into v_trip, v_status
  from public.trip_suggestions s
  where s.id = p_suggestion_id
  for update;

  if v_trip is null then
    raise exception 'not-found';
  end if;
  if v_status <> 'open' then
    raise exception 'not-open';
  end if;
  if not exists (
    select 1 from public.trips t where t.id = v_trip and t.user_id = p_actor
  ) then
    raise exception 'forbidden';
  end if;

  update public.trip_suggestions
  set
    status = 'accepted',
    decided_by = p_actor,
    decided_at = now()
  where id = p_suggestion_id
    and status = 'open';

  if not found then
    raise exception 'not-open';
  end if;

  return p_suggestion_id;
end;
$$;

create or replace function public.agent_dismiss_suggestion(
  p_actor uuid,
  p_suggestion_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip uuid;
  v_status text;
begin
  if p_actor is null then
    raise exception 'actor-required';
  end if;

  select s.trip_id, s.status
    into v_trip, v_status
  from public.trip_suggestions s
  where s.id = p_suggestion_id
  for update;

  if v_trip is null then
    raise exception 'not-found';
  end if;
  if v_status <> 'open' then
    raise exception 'not-open';
  end if;
  if not exists (
    select 1 from public.trips t where t.id = v_trip and t.user_id = p_actor
  ) then
    raise exception 'forbidden';
  end if;

  update public.trip_suggestions
  set
    status = 'dismissed',
    decided_by = p_actor,
    decided_at = now()
  where id = p_suggestion_id
    and status = 'open';

  if not found then
    raise exception 'not-open';
  end if;

  return p_suggestion_id;
end;
$$;

revoke all on function public.agent_accept_settle_suggestion(uuid, uuid, text, jsonb) from public;
revoke all on function public.agent_accept_rebalance_suggestion(uuid, uuid, jsonb) from public;
revoke all on function public.agent_mark_suggestion_accepted(uuid, uuid) from public;
revoke all on function public.agent_dismiss_suggestion(uuid, uuid) from public;

grant execute on function public.agent_accept_settle_suggestion(uuid, uuid, text, jsonb) to service_role;
grant execute on function public.agent_accept_rebalance_suggestion(uuid, uuid, jsonb) to service_role;
grant execute on function public.agent_mark_suggestion_accepted(uuid, uuid) to service_role;
grant execute on function public.agent_dismiss_suggestion(uuid, uuid) to service_role;
