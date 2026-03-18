begin;

-- Realtime is driven by REPLICA IDENTITY; FULL ensures updates emit full row payloads.
alter table public.ls_matches replica identity full;
alter table public.ls_innings replica identity full;
alter table public.ls_match_state replica identity full;

-- Enable realtime only for: ls_matches, ls_match_state, ls_innings
do $$
begin
  -- Publication exists on Supabase projects; this is safe for db push.
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table public.ls_matches';
    execute 'alter publication supabase_realtime add table public.ls_innings';
    execute 'alter publication supabase_realtime add table public.ls_match_state';
  end if;
exception
  when duplicate_object then
    -- Table already added to publication; ignore.
    null;
end $$;

commit;
