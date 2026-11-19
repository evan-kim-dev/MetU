-- VERIFY: trip_suggestions + accept RPCs (수동 확인용)
-- 기대: table/rpc 존재, authenticated 는 select 만, update 없음.

select to_regclass('public.trip_suggestions') as trip_suggestions_table;

select proname
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in (
    'agent_create_suggestion',
    'agent_accept_settle_suggestion',
    'agent_accept_rebalance_suggestion',
    'agent_mark_suggestion_accepted',
    'agent_dismiss_suggestion'
  )
order by proname;

select has_table_privilege('authenticated', 'public.trip_suggestions', 'SELECT') as auth_select;
select has_table_privilege('authenticated', 'public.trip_suggestions', 'UPDATE') as auth_update; -- expect false after 20261120020000
select has_table_privilege('authenticated', 'public.trip_suggestions', 'INSERT') as auth_insert; -- expect false
