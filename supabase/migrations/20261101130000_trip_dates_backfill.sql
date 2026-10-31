-- P1 (fix/trip-match-ingest): 알림 → 여행 매칭 복구.
--
-- 1) trips.start_date / end_date 백필 — date_range 가 "확실한" ISO 계열일 때만.
--    애매한 한글 라벨("8월 중순" 등)은 건드리지 않는다. 그건 앱 코드(suggestTripDates)가 처리한다.
--      · 'YYYY-MM-DD ~ YYYY-MM-DD', 'YYYY.MM.DD - YYYY.MM.DD', 'YYYY.MM.DD~MM.DD'
--      · 'YYYY-MM-DD · N박 M일'  (퀵 여행)
--      · 'YYYY-MM-DD'
-- 2) agent_attach_unassigned 에 선택 인자 p_start/p_end 추가.
--    trips.start_date 가 NULL 이면 호출자가 넘긴 값을 쓰고, 둘 다 없으면 0 을 돌려준다.
--    (기존 2-인자 함수는 오버로드 모호성을 피하려고 drop 후 기본값 인자 버전으로 대체)
-- 3) agent_ensure_owner_member — 서버(service_role)에서 본인 trip_members 행을 멱등 보장.
--
-- 멱등: 여러 번 실행해도 같은 결과. 데이터 삭제 없음. 롤백 불필요.

-- ---------------------------------------------------------------------------
-- 1) backfill
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  m text[];
  v_start date;
  v_end date;
  v_end_year int;
  v_nights int;
begin
  for r in
    select t.id, t.date_range
    from public.trips t
    where t.start_date is null
      and t.date_range is not null
      and t.date_range ~ '^\s*\d{4}[-./]\d{1,2}[-./]\d{1,2}'
  loop
    v_start := null;
    v_end := null;
    begin
      -- 두 날짜 (끝 연도는 생략 가능)
      m := regexp_match(
        r.date_range,
        '^\s*(\d{4})[-./](\d{1,2})[-./](\d{1,2})\s*[~–—-]\s*(?:(\d{4})[-./])?(\d{1,2})[-./](\d{1,2})\s*$'
      );
      if m is not null then
        v_start := make_date(m[1]::int, m[2]::int, m[3]::int);
        v_end_year := coalesce(m[4]::int, m[1]::int);
        v_end := make_date(v_end_year, m[5]::int, m[6]::int);
        if m[4] is null and v_end < v_start then
          v_end := make_date(v_end_year + 1, m[5]::int, m[6]::int);
        end if;
      else
        -- 시작일 + N박
        m := regexp_match(
          r.date_range,
          '^\s*(\d{4})[-./](\d{1,2})[-./](\d{1,2})\s*[·,]?\s*(\d+)\s*박'
        );
        if m is not null then
          v_nights := m[4]::int;
          if v_nights between 0 and 60 then
            v_start := make_date(m[1]::int, m[2]::int, m[3]::int);
            v_end := v_start + v_nights;
          end if;
        else
          -- 날짜 하나
          m := regexp_match(
            r.date_range,
            '^\s*(\d{4})[-./](\d{1,2})[-./](\d{1,2})\s*$'
          );
          if m is not null then
            v_start := make_date(m[1]::int, m[2]::int, m[3]::int);
            v_end := v_start;
          end if;
        end if;
      end if;

      if v_start is not null and v_end is not null and v_end >= v_start then
        update public.trips
        set start_date = v_start,
            end_date = coalesce(end_date, v_end)
        where id = r.id and start_date is null;
      end if;
    exception when others then
      -- 존재하지 않는 날짜(예: 02-31) 등은 건너뛴다 (애매하면 건드리지 않음).
      null;
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2) agent_attach_unassigned (p_start / p_end 옵션)
-- ---------------------------------------------------------------------------
drop function if exists public.agent_attach_unassigned(uuid, uuid);

create or replace function public.agent_attach_unassigned(
  p_user_id uuid,
  p_trip_id uuid,
  p_start date default null,
  p_end date default null
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

  -- 저장된 날짜가 우선. 없으면 호출자가 넘긴 값을 쓰고, 그것도 없으면 붙일 수 없다.
  if v_start is null then
    v_start := p_start;
    v_end := p_end;
  end if;
  if v_start is null then
    return 0;
  end if;
  if v_end is null or v_end < v_start then
    v_end := v_start;
  end if;

  -- Asia/Seoul calendar days with ±1 day slack (= "exact" rule in trip-match.ts).
  v_window_start := ((v_start - 1)::text || ' 00:00:00')::timestamp
    at time zone 'Asia/Seoul';
  v_window_end := ((v_end + 1)::text || ' 23:59:59.999')::timestamp
    at time zone 'Asia/Seoul';

  with attached as (
    update public.agent_events e
    set
      trip_id = p_trip_id,
      status = 'received',
      result = jsonb_build_object('match', jsonb_build_object('rule', 'exact')),
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

revoke all on function public.agent_attach_unassigned(uuid, uuid, date, date)
  from public, anon, authenticated;
grant execute on function public.agent_attach_unassigned(uuid, uuid, date, date) to service_role;

-- ---------------------------------------------------------------------------
-- 3) agent_ensure_owner_member
-- ---------------------------------------------------------------------------
-- 이벤트 사용자가 여행 소유자이거나 이미 멤버이면 본인 trip_members 행 id 를 돌려준다.
-- 소유자인데 행이 없으면 만든다(멱등). 소유자도 멤버도 아니면 'forbidden'.
create or replace function public.agent_ensure_owner_member(
  p_actor uuid,
  p_trip_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_owner uuid;
  v_name text;
begin
  if p_actor is null or p_trip_id is null then
    raise exception 'actor-required';
  end if;

  select t.user_id into v_owner
  from public.trips t
  where t.id = p_trip_id;

  if v_owner is null then
    raise exception 'trip-not-found';
  end if;

  select m.id into v_id
  from public.trip_members m
  where m.trip_id = p_trip_id and m.user_id = p_actor
  limit 1;

  if v_id is not null then
    return v_id;
  end if;

  if v_owner <> p_actor then
    raise exception 'forbidden';
  end if;

  select coalesce(nullif(trim(p.display_name), ''), '나') into v_name
  from public.profiles p
  where p.id = p_actor;
  v_name := left(coalesce(v_name, '나'), 30);

  begin
    insert into public.trip_members (trip_id, user_id, display_name, role, is_owner)
    values (p_trip_id, p_actor, v_name, 'owner', true)
    returning id into v_id;
  exception when unique_violation then
    -- 동시 호출로 이미 생겼거나, 같은 이름의 자리표시 멤버가 있는 경우
    select m.id into v_id
    from public.trip_members m
    where m.trip_id = p_trip_id and m.user_id = p_actor
    limit 1;

    if v_id is null then
      insert into public.trip_members (trip_id, user_id, display_name, role, is_owner)
      values (p_trip_id, p_actor, left(v_name, 24) || ' (나)', 'owner', true)
      on conflict do nothing
      returning id into v_id;
    end if;
  end;

  if v_id is null then
    select m.id into v_id
    from public.trip_members m
    where m.trip_id = p_trip_id and m.user_id = p_actor
    limit 1;
  end if;

  return v_id;
end;
$$;

revoke all on function public.agent_ensure_owner_member(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.agent_ensure_owner_member(uuid, uuid) to service_role;
