begin;

-- Required performance indexes
create index if not exists idx_ls_balls_innings_sequence
  on public.ls_balls (innings_id, sequence);

create index if not exists idx_ls_batting_stats_innings_player
  on public.ls_batting_stats (innings_id, player_id);

create index if not exists idx_ls_bowling_stats_innings_player
  on public.ls_bowling_stats (innings_id, player_id);

create index if not exists idx_ls_match_state_match
  on public.ls_match_state (match_id);

create index if not exists idx_ls_matches_tournament
  on public.ls_matches (tournament_id);

-- Common access patterns
create index if not exists idx_ls_innings_match_number
  on public.ls_innings (match_id, innings_number);

create index if not exists idx_players_team
  on public.players (team_id);

commit;
