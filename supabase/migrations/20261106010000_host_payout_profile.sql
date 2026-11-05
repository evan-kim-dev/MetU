-- 호스트 입금 계좌 프로필 + 공유 정산 RPC 노출.
-- profiles 공개 SELECT 에 계좌를 두지 않음 (유출 방지).
-- 공유 토큰 소지자만 security definer RPC 로 bank/accountNo 를 받는다.

create table if not exists public.ledger_payout_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  bank text not null
    check (char_length(trim(bank)) between 1 and 40),
  account_no text not null
    check (char_length(regexp_replace(account_no, '[^0-9]', '', 'g')) between 4 and 64),
  updated_at timestamptz not null default now()
);

alter table public.ledger_payout_profiles enable row level security;

drop policy if exists "ledger_payout_profiles_own" on public.ledger_payout_profiles;
create policy "ledger_payout_profiles_own"
  on public.ledger_payout_profiles for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.set_ledger_payout_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ledger_payout_profiles_updated_at on public.ledger_payout_profiles;
create trigger ledger_payout_profiles_updated_at
  before update on public.ledger_payout_profiles
  for each row execute function public.set_ledger_payout_profiles_updated_at();

-- K5 billed 필드 유지 + hostPayout 추가
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
  v_payout jsonb;
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

  select case
    when p.user_id is null then null
    else jsonb_build_object(
      'bank', p.bank,
      'accountNo', p.account_no
    )
  end
    into v_payout
  from public.ledger_payout_profiles p
  where p.user_id = v_trip.user_id;

  return jsonb_build_object(
    'destination', v_trip.destination,
    'dateRange', v_trip.date_range,
    'version', v_s.version,
    'status', v_s.status,
    'completedAt', v_s.completed_at,
    'settledAt', v_s.created_at,
    'hostPayout', v_payout,
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
