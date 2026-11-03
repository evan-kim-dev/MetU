-- K6: 일본 면세 환급 트래커용 컬럼.
-- tax_free: 사용자가 확인한 면세 대상 여부 (비전 제안은 초기값만).
-- tax_excl_amount: 원통화 세별도 금액. 고정 세율 역산 금지.

alter table public.trip_expenses
  add column if not exists tax_free boolean not null default false;

alter table public.trip_expenses
  add column if not exists tax_excl_amount numeric;

comment on column public.trip_expenses.tax_free is
  '일본 면세(택스리펀드) 대상으로 사용자가 표시한 지출';
comment on column public.trip_expenses.tax_excl_amount is
  '원통화 세별도 금액. 환급액 계산용이 아니라 5,000엔 기준 판정용';
