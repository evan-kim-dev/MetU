-- 게스트 멤버십 트리거 보정 (V0 보고서 X1·I3)
--
-- X1: 20261103140000 의 trip_members_guest_guard 가 user_id 변경을 모두 막아서,
--     익명 게스트가 join_trip 으로 호스트가 미리 만든 이름 자리(user_id null)를
--     가져가면 42501 로 합류 전체가 롤백됐어요.
--     빈 자리 → 본인(auth.uid()) 전환만 허용해요. trip_members_update 정책의 using 이
--     "호스트 또는 user_id = auth.uid()" 라서 익명은 빈 자리를 직접 UPDATE 할 수 없고,
--     이 전환은 security definer 인 join_trip 에서만 일어나요.
-- I3: 익명은 is_owner 도 바꿀 수 없어요(앱이 role 또는 is_owner 로 호스트를 판정).
--
-- 기존 마이그레이션은 수정하지 않고 함수만 교체해요. 트리거는 그대로 이 함수를 써요.

create or replace function public.trip_members_guest_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if (select (auth.jwt() ->> 'is_anonymous')::boolean) is true then
    if new.trip_id is distinct from old.trip_id
       or new.role is distinct from old.role
       or new.is_owner is distinct from old.is_owner
       or (
         new.user_id is distinct from old.user_id
         and not (old.user_id is null and new.user_id = (select auth.uid()))
       ) then
      raise exception 'guest-cannot-change-membership'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
