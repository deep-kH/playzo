begin;

-- High-frequency tables: favor HOT updates / lower bloat where possible
alter table public.ls_match_state set (fillfactor = 80);
alter table public.ls_balls set (fillfactor = 90);

-- Reduce lock contention by using row-level locks in RPCs (already done),
-- and keep planner stats current.
analyze public.ls_matches;
analyze public.ls_innings;
analyze public.ls_match_state;
analyze public.ls_balls;
analyze public.ls_batting_stats;
analyze public.ls_bowling_stats;

commit;

