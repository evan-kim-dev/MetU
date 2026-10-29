-- Allow notification linking before a trip exists.
-- Tokens and events can be user-scoped (trip_id null) and bound later.

alter table public.agent_ingest_tokens
  alter column trip_id drop not null;

alter table public.agent_events
  alter column trip_id drop not null;

-- User-scoped tokens: one active unbound token lookup by user.
create index if not exists agent_ingest_tokens_user_unbound_idx
  on public.agent_ingest_tokens (user_id)
  where revoked_at is null and trip_id is null;

-- Parked events waiting for a trip.
create index if not exists agent_events_user_unbound_idx
  on public.agent_events (user_id, created_at)
  where trip_id is null;
