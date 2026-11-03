-- K5: 공유 정산 상세에 billedKrw·feePct(서버 계산)만 추가.
-- feePct = 시장환율 대비 차이(%) = (billed_krw - krw_base) / krw_base * 100, 소수 1자리.
-- 개인 식별 필드·영수증 경로·메모·카드정보는 반환하지 않음. anon grant 유지.

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
        'krwAmount', x.krw_amount,
        'billedKrw', x.billed_krw,
        'feePct', x.fee_pct
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
          e.billed_krw,
          case
            when e.billed_krw is not null
              and e.krw_base is not null
              and e.krw_base > 0
            then round(
              ((e.billed_krw::numeric - e.krw_base::numeric)
                / e.krw_base::numeric) * 1000
            ) / 10
            else null
          end as fee_pct,
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
