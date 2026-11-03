-- =============================================================================
-- guest_permissions_verify.sql
-- Evan이 Supabase SQL Editor에서 블록 단위로 실행.
-- 시크릿·실사용자 데이터를 출력하지 않는다. 쓰기 테스트는 begin…rollback 만.
--
-- 적용 순서:
--   1) 블록 A (읽기, 마이그레이션 전/후 점검)
--   2) 마이그레이션 20261103140000_guest_permissions.sql 적용
--      (PR 머지 후 npm run db:push 또는 SQL Editor에 파일 붙여넣기)
--   3) 블록 A 재실행 → 블록 B → 블록 C
--   4) 블록 D는 주석 처리 — 지금은 실행하지 않음
--   (+) 20261103220000_guest_claim_trigger.sql 적용 후 A9 · T19 · T20 으로 확인
--
-- 대시보드 확인(a): Authentication → Providers → Allow anonymous sign-ins
--   (SQL로는 확인 불가)
-- =============================================================================


-- ###########################################################################
-- 블록 A — 마이그레이션 적용 확인 (읽기 전용)
-- 기대:
--   · schema_migrations 에 20261103100000 / 110000 / 120000 (대상) + 140000 (이 PR)
--   · billed_krw 컬럼, agent_apply_billed_krw / agent_apply_split_patch 함수,
--     trip_expense_split_history 테이블, notifications_type_check 에 expense_dcc
--   · anon_block% 정책 목록 (140000 적용 후)
-- ###########################################################################

-- A1) 적용된 마이그레이션 버전
select version
from supabase_migrations.schema_migrations
where version like '20261103%'
order by 1;

-- (버전 문자열이 파일명 전체일 때용 — 필요하면 주석 해제)
-- select version
-- from supabase_migrations.schema_migrations
-- where version like '%20261103%'
-- order by 1;

-- A2) K1 billed_krw 컬럼
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'trip_expenses'
  and column_name = 'billed_krw';
-- 기대: 1행 (bigint)

-- A3) 함수 존재
select p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('agent_apply_billed_krw', 'agent_apply_split_patch',
                    'resolve_expense_proposal', 'set_expense_payer',
                    'trip_members_guest_guard')
order by 1;
-- 기대(140000 후): 위 5개 모두

-- A4) split history 테이블
select to_regclass('public.trip_expense_split_history') as split_history;
-- 기대: trip_expense_split_history

-- A5) notifications expense_dcc
select pg_get_constraintdef(c.oid) as def
from pg_constraint c
join pg_class t on t.oid = c.conrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public'
  and t.relname = 'notifications'
  and c.conname like '%type%';
-- 기대: def 문자열에 'expense_dcc' 포함

-- A6) 쓰기 가능 테이블 정책 목록 (빠진 테이블 점검용)
select tablename, policyname, cmd, permissive
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- A7) anon_block 정책
select schemaname, tablename, policyname, permissive, cmd
from pg_policies
where policyname like 'anon_block%'
order by 2, 3;
-- 기대(140000 후): trips/trip_invites/community_* / party_* INSERT
--   + trip_expenses/shares INSERT/UPDATE/DELETE
--   (trip_plans·budget_insight_logs 는 20260711210000 에서 drop 돼서 정책이 없어요)

-- A8) proposals 테이블
select to_regclass('public.trip_expense_proposals') as proposals;
-- 기대(140000 후): trip_expense_proposals

-- A9) 220000 적용 확인: 게스트 트리거가 빈 자리 claim 을 허용하고 is_owner 를 막는지
select
  position('old.user_id is null'
    in pg_get_functiondef('public.trip_members_guest_guard()'::regprocedure)) > 0
    as claim_allowed,
  position('is_owner'
    in pg_get_functiondef('public.trip_members_guest_guard()'::regprocedure)) > 0
    as is_owner_guarded;
-- 기대(220000 후): true, true


-- ###########################################################################
-- 블록 B — 익명 RLS 동작 (롤백 트랜잭션, 합성 데이터만)
-- 기대: T1~T20 각 NOTICE 가 PASS/<기대코드> 형태. T18은 수동.
--   T19·T20 은 20261103220000 적용 후에만 PASS (이전엔 T19 FAIL = V0 X1 재현).
-- 반드시 마지막 rollback.
-- ###########################################################################

begin;

do $$
declare
  v_host uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_guest uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  v_guest2 uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  v_guest3 uuid := 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  v_trip uuid := 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  v_trip2 uuid := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  v_host_m uuid;
  v_guest_m uuid;
  v_guest2_m uuid;
  v_exp uuid;
  v_exp2 uuid;
  v_prop uuid;
  v_prop_other uuid;
  v_other_m uuid;
  v_claim_m uuid;
  v_joined uuid;
  v_state text;
  v_msg text;
  v_cnt int;
  i int;
begin
  -- 이전 잔여 합성 데이터 정리(같은 uuid 재실행 대비)
  delete from public.trip_expense_proposals
  where trip_id in (v_trip, v_trip2);
  delete from public.trip_expense_shares
  where trip_id in (v_trip, v_trip2);
  delete from public.trip_expenses
  where trip_id in (v_trip, v_trip2);
  delete from public.trip_invites
  where trip_id in (v_trip, v_trip2);
  delete from public.trip_members
  where trip_id in (v_trip, v_trip2);
  delete from public.trips
  where id in (v_trip, v_trip2);
  delete from auth.users
  where id in (v_host, v_guest, v_guest2, v_guest3);

  -- 합성 호스트 (비익명)
  -- auth.users 필수 컬럼은 프로젝트 버전에 따라 다를 수 있음 → 실패 시
  -- information_schema 로 NOT NULL 컬럼을 확인해 보완.
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    is_anonymous
  ) values (
    v_host,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    's0-host-synth@example.invalid',
    crypt('synth-only', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"S0 Host"}'::jsonb,
    now(),
    now(),
    '', '', '', '',
    false
  );

  -- 합성 게스트 (익명, 이메일 null → profiles 트리거도 검증)
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    is_anonymous
  ) values (
    v_guest,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    null,
    crypt('synth-only', gen_salt('bf')),
    now(),
    '{"provider":"anonymous","providers":["anonymous"]}'::jsonb,
    '{"name":"S0 Guest"}'::jsonb,
    now(),
    now(),
    '', '', '', '',
    true
  );

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    is_anonymous
  ) values (
    v_guest2,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    null,
    crypt('synth-only', gen_salt('bf')),
    now(),
    '{"provider":"anonymous","providers":["anonymous"]}'::jsonb,
    '{"name":"S0 Guest2"}'::jsonb,
    now(),
    now(),
    '', '', '', '',
    true
  );

  -- 합성 게스트3 (익명, 아직 멤버 아님 → T19 이름 자리 claim)
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    is_anonymous
  ) values (
    v_guest3,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    null,
    crypt('synth-only', gen_salt('bf')),
    now(),
    '{"provider":"anonymous","providers":["anonymous"]}'::jsonb,
    '{"name":"S0 Guest3"}'::jsonb,
    now(),
    now(),
    '', '', '', '',
    true
  );

  -- profiles 트리거 검증 (이메일 없는 익명)
  if not exists (select 1 from public.profiles where id = v_guest) then
    raise notice 'T0 FAIL/profiles-missing';
  else
    raise notice 'T0 PASS/profiles-created';
  end if;

  -- 시드: SQL Editor 세션(보통 postgres/supabase_admin)으로 여행·멤버·지출
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_host::text, 'role', 'authenticated', 'is_anonymous', false)::text,
    true);

  insert into public.trips (id, user_id, destination, country, status)
  values (v_trip, v_host, 'S0 Test', 'JP', 'upcoming');

  insert into public.trips (id, user_id, destination, country, status)
  values (v_trip2, v_host, 'S0 Other', 'JP', 'upcoming');

  insert into public.trip_members (trip_id, user_id, display_name, role, is_owner)
  values (v_trip, v_host, '호스트', 'owner', true)
  returning id into v_host_m;

  insert into public.trip_members (trip_id, user_id, display_name, role, is_owner)
  values (v_trip, v_guest, '게스트', 'member', false)
  returning id into v_guest_m;

  insert into public.trip_members (trip_id, user_id, display_name, role, is_owner)
  values (v_trip, v_guest2, '게스트2', 'member', false)
  returning id into v_guest2_m;

  insert into public.trip_members (trip_id, user_id, display_name, role, is_owner)
  values (v_trip2, v_host, '호스트2', 'owner', true);

  -- 호스트가 미리 만든 이름 자리(user_id null) + 초대 (T19)
  insert into public.trip_members (trip_id, user_id, display_name, role, is_owner)
  values (v_trip, null, '민수', 'member', false)
  returning id into v_claim_m;

  insert into public.trip_invites (trip_id, token_hash, created_by, expires_at, max_uses)
  values (
    v_trip,
    encode(sha256(convert_to('s0-claim-synth-token', 'utf8')), 'hex'),
    v_host,
    now() + interval '1 day',
    4
  );

  insert into public.trip_expenses (
    trip_id, created_by, paid_by, label, amount, currency,
    fx_rate_to_krw, krw_amount, status
  ) values (
    v_trip, v_host, v_host_m, '시드 지출', 1000, 'KRW',
    1, 1000, 'confirmed'
  ) returning id into v_exp;

  insert into public.trip_expense_shares (expense_id, member_id, share_krw, trip_id)
  values
    (v_exp, v_host_m, 500, v_trip),
    (v_exp, v_guest_m, 500, v_trip);

  insert into public.trip_expenses (
    trip_id, created_by, paid_by, label, amount, currency,
    fx_rate_to_krw, krw_amount, status
  )
  select v_trip2, v_host, m.id, '다른여행지출', 2000, 'KRW', 1, 2000, 'confirmed'
  from public.trip_members m
  where m.trip_id = v_trip2 and m.user_id = v_host
  returning id into v_exp2;

  -- 게스트 JWT로 전환
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', v_guest::text,
      'role', 'authenticated',
      'is_anonymous', true
    )::text,
    true
  );
  set local role authenticated;

  -- T1 trips INSERT → 42501
  begin
    insert into public.trips (user_id, destination)
    values (v_guest, '게스트여행');
    raise notice 'T1 FAIL/allowed';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    raise notice 'T1 %/%',
      case when v_state = '42501' then 'PASS' else 'FAIL' end, v_state;
  end;

  -- T2 trip_invites INSERT → 거부
  begin
    insert into public.trip_invites (trip_id, created_by, token_hash, expires_at)
    values (v_trip, v_guest, 's0-synth-token-hash-xxxxxx', now() + interval '1 day');
    raise notice 'T2 FAIL/allowed';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    raise notice 'T2 PASS/%', v_state;
  end;

  -- T3 trip_expenses INSERT → 42501
  begin
    insert into public.trip_expenses (
      trip_id, created_by, paid_by, label, amount, currency,
      fx_rate_to_krw, krw_amount, status
    ) values (
      v_trip, v_guest, v_guest_m, '게스트지출', 100, 'KRW',
      1, 100, 'confirmed'
    );
    raise notice 'T3 FAIL/allowed';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    raise notice 'T3 %/%',
      case when v_state = '42501' then 'PASS' else 'FAIL' end, v_state;
  end;

  -- T4 호스트 지출 UPDATE/DELETE → 0행 또는 42501
  begin
    update public.trip_expenses set label = 'hack' where id = v_exp;
    get diagnostics v_cnt = row_count;
    if v_cnt = 0 then
      raise notice 'T4a PASS/0rows';
    else
      raise notice 'T4a FAIL/updated';
    end if;
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    raise notice 'T4a %/%',
      case when v_state = '42501' then 'PASS' else 'FAIL' end, v_state;
  end;

  begin
    delete from public.trip_expenses where id = v_exp;
    get diagnostics v_cnt = row_count;
    if v_cnt = 0 then
      raise notice 'T4b PASS/0rows';
    else
      raise notice 'T4b FAIL/deleted';
    end if;
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    raise notice 'T4b %/%',
      case when v_state = '42501' then 'PASS' else 'FAIL' end, v_state;
  end;

  -- T5 shares UPDATE 거부
  begin
    update public.trip_expense_shares
    set share_krw = 1
    where expense_id = v_exp and member_id = v_host_m;
    get diagnostics v_cnt = row_count;
    if v_cnt = 0 then
      raise notice 'T5 PASS/0rows';
    else
      raise notice 'T5 FAIL/updated';
    end if;
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    raise notice 'T5 PASS/%', v_state;
  end;

  -- T6 role UPDATE → guest-cannot-change-membership
  begin
    update public.trip_members set role = 'owner' where id = v_guest_m;
    raise notice 'T6 FAIL/allowed';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
    raise notice 'T6 %/% %',
      case
        when v_msg like '%guest-cannot-change-membership%' then 'PASS'
        else 'FAIL'
      end,
      v_state,
      left(v_msg, 60);
  end;

  -- T7 display_name UPDATE 성공
  begin
    update public.trip_members
    set display_name = '게스트닉'
    where id = v_guest_m;
    get diagnostics v_cnt = row_count;
    raise notice 'T7 %/%',
      case when v_cnt = 1 then 'PASS' else 'FAIL' end, v_cnt;
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    raise notice 'T7 FAIL/%', v_state;
  end;

  -- T8 proposals INSERT 성공
  begin
    insert into public.trip_expense_proposals (
      trip_id, proposed_by, proposer_member_id, label, amount, currency, status
    ) values (
      v_trip, v_guest, v_guest_m, '택시', 3000, 'KRW', 'pending'
    ) returning id into v_prop;
    raise notice 'T8 PASS';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
    raise notice 'T8 FAIL/% %', v_state, left(v_msg, 80);
  end;

  -- T9 다른 사람 member id로 INSERT → 거부
  begin
    insert into public.trip_expense_proposals (
      trip_id, proposed_by, proposer_member_id, label, amount, currency, status
    ) values (
      v_trip, v_guest, v_host_m, '위장', 100, 'KRW', 'pending'
    );
    raise notice 'T9 FAIL/allowed';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    raise notice 'T9 PASS/%', v_state;
  end;

  -- T10 status=approved INSERT → 거부
  begin
    insert into public.trip_expense_proposals (
      trip_id, proposed_by, proposer_member_id, label, amount, currency, status
    ) values (
      v_trip, v_guest, v_guest_m, '승인위장', 100, 'KRW', 'approved'
    );
    raise notice 'T10 FAIL/allowed';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    raise notice 'T10 PASS/%', v_state;
  end;

  -- T11 같은 게스트 6번째 pending → too-many-pending
  -- (T8에서 1건, 여기 4건 더 = 5, 그다음 6번째 실패)
  begin
    for i in 1..4 loop
      insert into public.trip_expense_proposals (
        trip_id, proposed_by, proposer_member_id, label, amount, currency, status
      ) values (
        v_trip, v_guest, v_guest_m, 'pending' || i::text, 100 + i, 'KRW', 'pending'
      );
    end loop;
    begin
      insert into public.trip_expense_proposals (
        trip_id, proposed_by, proposer_member_id, label, amount, currency, status
      ) values (
        v_trip, v_guest, v_guest_m, 'overflow', 999, 'KRW', 'pending'
      );
      raise notice 'T11 FAIL/allowed';
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
      raise notice 'T11 %/% %',
        case
          when v_msg like '%too-many-pending%' then 'PASS'
          else 'FAIL'
        end,
        v_state,
        left(v_msg, 40);
    end;
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
    raise notice 'T11 FAIL-setup/% %', v_state, left(v_msg, 60);
  end;

  -- T12 다른 게스트 제안 SELECT 0행 / 자기 것은 보임
  -- guest2 제안 시드(서비스 롤)
  reset role;
  insert into public.trip_expense_proposals (
    trip_id, proposed_by, proposer_member_id, label, amount, currency, status
  ) values (
    v_trip, v_guest2, v_guest2_m, '다른제안', 500, 'KRW', 'pending'
  ) returning id into v_prop_other;

  -- 다시 게스트1
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_guest::text, 'role', 'authenticated', 'is_anonymous', true)::text,
    true
  );
  set local role authenticated;

  select count(*)::int into v_cnt
  from public.trip_expense_proposals
  where id = v_prop_other;
  raise notice 'T12a %/%',
    case when v_cnt = 0 then 'PASS' else 'FAIL' end, v_cnt;

  select count(*)::int into v_cnt
  from public.trip_expense_proposals
  where proposed_by = v_guest and status = 'pending';
  raise notice 'T12b %/%',
    case when v_cnt >= 1 then 'PASS' else 'FAIL' end, v_cnt;

  -- T13 resolve approved → forbidden; withdrawn 본인 → 성공
  begin
    perform public.resolve_expense_proposal(v_prop, 'approved', v_exp, null);
    raise notice 'T13a FAIL/allowed';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
    raise notice 'T13a %/% %',
      case when v_msg like '%forbidden%' or v_state = '42501' then 'PASS' else 'FAIL' end,
      v_state,
      left(v_msg, 40);
  end;

  begin
    perform public.resolve_expense_proposal(v_prop, 'withdrawn', null, null);
    raise notice 'T13b PASS';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
    raise notice 'T13b FAIL/% %', v_state, left(v_msg, 60);
  end;

  -- T14 set_expense_payer → forbidden
  begin
    perform public.set_expense_payer(v_exp, v_guest_m);
    raise notice 'T14 FAIL/allowed';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
    raise notice 'T14 %/% %',
      case when v_msg like '%forbidden%' or v_state = '42501' then 'PASS' else 'FAIL' end,
      v_state,
      left(v_msg, 40);
  end;

  -- T15 호스트로 전환: approve 성공 / 다른 trip 지출 → bad-expense
  reset role;
  insert into public.trip_expense_proposals (
    trip_id, proposed_by, proposer_member_id, label, amount, currency, status
  ) values (
    v_trip, v_guest, v_guest_m, '승인대상', 4000, 'KRW', 'pending'
  ) returning id into v_prop;

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_host::text, 'role', 'authenticated', 'is_anonymous', false)::text,
    true
  );
  set local role authenticated;

  begin
    perform public.resolve_expense_proposal(v_prop, 'approved', v_exp, null);
    raise notice 'T15a PASS';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
    raise notice 'T15a FAIL/% %', v_state, left(v_msg, 60);
  end;

  reset role;
  insert into public.trip_expense_proposals (
    trip_id, proposed_by, proposer_member_id, label, amount, currency, status
  ) values (
    v_trip, v_guest, v_guest_m, '잘못된승인', 100, 'KRW', 'pending'
  ) returning id into v_prop;

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_host::text, 'role', 'authenticated', 'is_anonymous', false)::text,
    true
  );
  set local role authenticated;

  begin
    perform public.resolve_expense_proposal(v_prop, 'approved', v_exp2, null);
    raise notice 'T15b FAIL/allowed';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
    raise notice 'T15b %/% %',
      case when v_msg like '%bad-expense%' then 'PASS' else 'FAIL' end,
      v_state,
      left(v_msg, 40);
  end;

  -- T16 set_expense_payer 성공 / 다른 trip 멤버 → bad-member
  begin
    perform public.set_expense_payer(v_exp, v_guest_m);
    raise notice 'T16a PASS';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
    raise notice 'T16a FAIL/% %', v_state, left(v_msg, 60);
  end;

  select id into v_other_m
  from public.trip_members
  where trip_id = v_trip2 and user_id = v_host
  limit 1;

  begin
    perform public.set_expense_payer(v_exp, v_other_m);
    raise notice 'T16b FAIL/allowed';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
    raise notice 'T16b %/% %',
      case when v_msg like '%bad-member%' then 'PASS' else 'FAIL' end,
      v_state,
      left(v_msg, 40);
  end;

  -- T17 호스트 trips INSERT 성공
  begin
    insert into public.trips (user_id, destination)
    values (v_host, '호스트정상여행');
    raise notice 'T17 PASS';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
    raise notice 'T17 FAIL/% %', v_state, left(v_msg, 60);
  end;

  -- T19 익명 게스트3 이 join_trip 으로 이름 자리 claim → 성공 (220000 후)
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', v_guest3::text,
      'role', 'authenticated',
      'is_anonymous', true
    )::text,
    true
  );
  begin
    v_joined := public.join_trip('s0-claim-synth-token', v_claim_m, null);
    raise notice 'T19 %/%',
      case
        when v_joined = v_claim_m
         and exists (
           select 1 from public.trip_members
           where id = v_claim_m and user_id = v_guest3
         )
        then 'PASS' else 'FAIL'
      end,
      case when v_joined = v_claim_m then 'claimed' else 'other-row' end;
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
    raise notice 'T19 FAIL/% % (220000 미적용이면 X1 재현)', v_state, left(v_msg, 60);
  end;

  -- T20 익명 게스트가 자기 행 is_owner 변경 → guest-cannot-change-membership (220000 후)
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', v_guest::text,
      'role', 'authenticated',
      'is_anonymous', true
    )::text,
    true
  );
  begin
    update public.trip_members set is_owner = true where id = v_guest_m;
    raise notice 'T20 FAIL/allowed';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
    raise notice 'T20 %/% %',
      case
        when v_msg like '%guest-cannot-change-membership%' then 'PASS'
        else 'FAIL'
      end,
      v_state,
      left(v_msg, 60);
  end;

  -- T18 mark_transfer_paid:
  -- 정산·송금 시드와 JWT claim(from_member) 매칭이 복잡하고,
  -- security definer 경로라 익명 restrictive INSERT와 별개다.
  -- → 수동 확인(K10 프리뷰에서 게스트가 자기 송금만 완료 표시).
  raise notice 'T18 SKIP/manual-k10-preview';

end $$;

rollback;


-- ###########################################################################
-- 블록 C — 위험 점검 (읽기 전용)
-- 기대: RLS off 테이블·anon 쓰기 grant 목록을 사람이 검토.
-- ###########################################################################

-- C1) RLS 꺼진 public 테이블
select schemaname, tablename
from pg_tables
where schemaname = 'public'
  and rowsecurity = false
order by 2;

-- C2) anon 에 INSERT/UPDATE/DELETE grant
select table_schema, table_name, privilege_type
from information_schema.role_table_grants
where grantee = 'anon'
  and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
  and table_schema = 'public'
order by 2, 3;

-- C3) trip_members_update 정책 정의 (with check 유무)
select policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'trip_members'
  and policyname = 'trip_members_update';
-- 참고: with_check 가 null 이면 UPDATE NEW 행은 using 만 검사(Postgres 기본).
-- 게스트 role 변경은 트리거(C)가 막는다.


-- ###########################################################################
-- 블록 D — 정리 (**지금 실행하지 않음** — 행사 후 선택)
-- ###########################################################################

-- !!! 실행 금지 (지금은 주석 유지) !!!
-- 30일 지난 익명 사용자 삭제. 데모·리허설 전에는 절대 실행하지 않는다.
--
-- delete from auth.users
-- where is_anonymous is true
--   and created_at < now() - interval '30 days';
