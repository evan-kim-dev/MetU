-- 호스트(trips.user_id)를 다른 가입 멤버에게 넘긴다.
-- 익명/미클레임(user_id null) 멤버는 받을 수 없음.
-- RLS 우회는 security definer 한 곳에서만. 호출자는 현재 호스트여야 함.

create or replace function public.transfer_trip_host(
  p_trip_id uuid,
  p_new_owner_member_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_trip_owner uuid;
  v_new public.trip_members%rowtype;
  v_old_member_id uuid;
begin
  if v_actor is null then
    raise exception 'forbidden';
  end if;
  if p_trip_id is null or p_new_owner_member_id is null then
    raise exception 'bad-args';
  end if;

  select t.user_id into v_trip_owner
  from public.trips t
  where t.id = p_trip_id
  for update;
  if not found then
    raise exception 'not-found';
  end if;
  if v_trip_owner is distinct from v_actor then
    raise exception 'forbidden';
  end if;

  select * into v_new
  from public.trip_members m
  where m.id = p_new_owner_member_id
    and m.trip_id = p_trip_id
  for update;
  if not found then
    raise exception 'bad-member';
  end if;
  if v_new.user_id is null then
    raise exception 'guest-cannot-host';
  end if;
  if v_new.user_id = v_actor then
    raise exception 'already-owner';
  end if;

  select m.id into v_old_member_id
  from public.trip_members m
  where m.trip_id = p_trip_id
    and m.user_id = v_actor
  limit 1;

  update public.trips
  set user_id = v_new.user_id,
      updated_at = now()
  where id = p_trip_id;

  update public.trip_members
  set role = 'member',
      is_owner = false
  where trip_id = p_trip_id
    and (role = 'owner' or coalesce(is_owner, false));

  update public.trip_members
  set role = 'owner',
      is_owner = true
  where id = p_new_owner_member_id
    and trip_id = p_trip_id;

  -- 구 호스트 멤버 행이 있으면 멤버로 남김(이미 위에서 demote)
  if v_old_member_id is null then
    null;
  end if;
end;
$$;

revoke all on function public.transfer_trip_host(uuid, uuid) from public;
grant execute on function public.transfer_trip_host(uuid, uuid) to authenticated;
