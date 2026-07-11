-- Drop unused convenience view and write-only tables that the app no longer reads.

drop view if exists public.community_posts_with_author;

drop table if exists public.trip_plans;
drop table if exists public.budget_insight_logs;
