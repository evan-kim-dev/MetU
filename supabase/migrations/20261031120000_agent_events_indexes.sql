-- Inbox / automation-status / settlement coalesce lookups.
-- VERIFY: apply manually in Supabase SQL editor (agent does not run against prod DB).

create index if not exists agent_events_user_created_idx
  on public.agent_events (user_id, created_at desc);

create index if not exists agent_events_trip_kind_status_idx
  on public.agent_events (trip_id, kind, status);
