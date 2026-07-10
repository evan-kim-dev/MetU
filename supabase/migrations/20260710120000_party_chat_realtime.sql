-- Realtime for party chat inserts
do $$
begin
  alter publication supabase_realtime add table public.party_chat_messages;
exception
  when duplicate_object then null;
end $$;
