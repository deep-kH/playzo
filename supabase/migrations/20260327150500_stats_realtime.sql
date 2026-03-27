begin;

alter table public.ls_batting_stats replica identity full;
alter table public.ls_bowling_stats replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table public.ls_batting_stats';
    execute 'alter publication supabase_realtime add table public.ls_bowling_stats';
  end if;
exception
  when duplicate_object then
    null;
end $$;

commit;
