-- P3: 공유받은 여행 읽기 + 공유 정산 상세(지출 내역)
-- Additive only. 기존 마이그레이션은 수정하지 않는다. 멱등(drop if exists / create or replace).
--
-- RLS 기대 동작 (수동 확인용; 합성 계정 A=소유자, B=멤버, C=비멤버)
--   trips:
--     A  select/update/delete 가능 (trips_select_own, trips_update_own, trips_delete_own)
--     B  select 가능 (trips_select_member, 이 파일) / update, delete 불가
--        (update/delete 정책은 소유자 전용 그대로 둔다)
--     C  select 불가 (0행)
--   trip_members / trip_expenses / trip_expense_shares:
--     B  select 가능 (is_trip_member), C  select 불가 (기존 정책)
--   trips_select_member 는 `to authenticated` 로 제한한다. anon 역할은
--   is_trip_member 실행 권한이 없어서, 정책을 anon 에 걸면 trips 조회가 오류가 된다.
--   is_trip_member 는 security definer 라 trips RLS 와 재귀하지 않는다.

-- ---------------------------------------------------------------------------
-- 1) 멤버도 trips 행을 읽을 수 있게
-- ---------------------------------------------------------------------------
drop policy if exists "trips_select_member" on public.trips;
create policy "trips_select_member"
  on public.trips for select
  to authenticated
  using (public.is_trip_member(id));

-- ---------------------------------------------------------------------------
-- 2) 공유 정산 상세 (로그인 불필요, 토큰 기반)
--    - 기존 get_shared_settlement 는 그대로 둔다.
--    - 지출은 정산 기준 시점(trip_settlements.created_at)까지만, 최대 200건.
--    - 반환하는 개인 정보는 멤버 표시 이름뿐이다. user_id, 이메일, 영수증 경로,
--      원문(raw_input), 카드 정보, 메모는 반환하지 않는다.
--    - totals.totalKrw 는 "기준 시점까지의 전체 지출 합계"이고, 지출이 200건을 넘으면
--      expensesTruncated=true 로 알려서 클라이언트가 합계 검증을 건너뛸 수 있게 한다.
-- ---------------------------------------------------------------------------
create or replace function public.get_shared_settlement_detail(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_s public.trip_settlements%rowtype;
  v_trip public.trips%rowtype;
  v_total bigint;
  v_count int;
begin
  if p_token is null or length(trim(p_token)) = 0 then
    return null;
  end if;

  select * into v_s from public.trip_settlements where share_token = p_token;
  if not found then return null; end if;

  select * into v_trip from public.trips where id = v_s.trip_id;
  if not found then return null; end if;

  select coalesce(sum(e.krw_amount), 0)::bigint, count(*)::int
    into v_total, v_count
  from public.trip_expenses e
  where e.trip_id = v_s.trip_id
    and e.created_at <= v_s.created_at
    and (e.status <> 'voided' or e.voided_at > v_s.created_at);

  return jsonb_build_object(
    'destination', v_trip.destination,
    'dateRange', v_trip.date_range,
    'version', v_s.version,
    'status', v_s.status,
    'completedAt', v_s.completed_at,
    'settledAt', v_s.created_at,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'displayName', m.display_name
      ) order by m.created_at)
      from public.trip_members m where m.trip_id = v_s.trip_id
    ), '[]'::jsonb),
    'transfers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'from', t.from_member,
        'to', t.to_member,
        'krw', t.krw,
        'status', t.status
      ) order by t.krw desc, t.id)
      from public.trip_settlement_transfers t
      where t.settlement_id = v_s.id
    ), '[]'::jsonb),
    'totals', jsonb_build_object(
      'totalKrw', v_total,
      'expenseCount', v_count,
      'expensesTruncated', v_count > 200
    ),
    'expenses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', x.id,
        'label', x.label,
        'category', x.category,
        'spentOn', x.spent_on,
        'paidBy', x.paid_by,
        'amount', x.amount,
        'currency', x.currency,
        'fxRateToKrw', x.fx_rate,
        'krwAmount', x.krw_amount
      ) order by x.spent_on nulls last, x.created_at, x.id)
      from (
        select
          e.id,
          coalesce(nullif(e.merchant, ''), nullif(e.label, ''), '지출') as label,
          e.category,
          e.spent_on,
          e.paid_by,
          e.amount,
          e.currency,
          coalesce(e.fx_rate, e.fx_rate_to_krw, 1) as fx_rate,
          e.krw_amount,
          e.created_at
        from public.trip_expenses e
        where e.trip_id = v_s.trip_id
          and e.created_at <= v_s.created_at
          and (e.status <> 'voided' or e.voided_at > v_s.created_at)
        order by e.spent_on nulls last, e.created_at, e.id
        limit 200
      ) x
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_shared_settlement_detail(text) from public;
grant execute on function public.get_shared_settlement_detail(text) to anon, authenticated;
