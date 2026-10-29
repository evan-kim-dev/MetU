-- Unassigned events: collect without a trip, attach by date window later.

alter table public.agent_events
  drop constraint if exists agent_events_status_check;

alter table public.agent_events
  add constraint agent_events_status_check
  check (status in (
    'received',
    'processing',
    'done',
    'needs_review',
    'ignored',
    'failed',
    'unassigned'
  ));

-- Parked "awaiting_trip" reviews become unassigned.
update public.agent_events
set
  status = 'unassigned',
  trip_id = null,
  result = coalesce(result, '{}'::jsonb) || jsonb_build_object('reason', 'unassigned'),
  processed_at = null,
  locked_at = null
where status = 'needs_review'
  and coalesce(result->>'reason', '') = 'awaiting_trip';

create index if not exists agent_events_unassigned_idx
  on public.agent_events (user_id, created_at desc)
  where status = 'unassigned' and trip_id is null;

-- Attach unassigned events whose received_at/created_at falls in the trip window
-- (±1 day, Asia/Seoul day bounds). Tokens are never bound to a trip.
create or replace function public.agent_attach_unassigned(
  p_user_id uuid,
  p_trip_id uuid
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start date;
  v_end date;
  v_window_start timestamptz;
  v_window_end timestamptz;
  v_count int := 0;
begin
  if p_user_id is null or p_trip_id is null then
    raise exception 'actor-required';
  end if;

  if not (
    exists (select 1 from public.trips t where t.id = p_trip_id and t.user_id = p_user_id)
    or exists (
      select 1 from public.trip_members m
      where m.trip_id = p_trip_id and m.user_id = p_user_id
    )
  ) then
    raise exception 'forbidden';
  end if;

  select t.start_date, t.end_date
  into v_start, v_end
  from public.trips t
  where t.id = p_trip_id;

  if v_start is null then
    return 0;
  end if;
  if v_end is null then
    v_end := v_start;
  end if;

  -- Asia/Seoul calendar days with ±1 day slack.
  v_window_start := ((v_start - 1)::text || ' 00:00:00')::timestamp
    at time zone 'Asia/Seoul';
  v_window_end := ((v_end + 1)::text || ' 23:59:59.999')::timestamp
    at time zone 'Asia/Seoul';

  with attached as (
    update public.agent_events e
    set
      trip_id = p_trip_id,
      status = 'received',
      result = null,
      error = null,
      processed_at = null,
      locked_at = null
    where e.user_id = p_user_id
      and e.status = 'unassigned'
      and e.trip_id is null
      and coalesce(
        nullif(e.payload->>'received_at', '')::timestamptz,
        nullif(e.payload->>'receivedAt', '')::timestamptz,
        e.created_at
      ) between v_window_start and v_window_end
    returning e.id
  )
  select count(*)::int into v_count from attached;

  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.agent_attach_unassigned(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.agent_attach_unassigned(uuid, uuid) to service_role;
