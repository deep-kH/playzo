begin;

-- Fix RLS: allow public read for both live AND completed matches
-- Also add missing policies for batting_stats, bowling_stats, and tournaments

-- 1. Matches: allow read for live AND completed
drop policy if exists "public_read_live_matches" on public.ls_matches;
create policy "public_read_live_completed_matches"
on public.ls_matches
for select
to anon, authenticated
using (status in ('live'::public.match_status, 'completed'::public.match_status));

-- 2. Innings: allow read for live AND completed matches
drop policy if exists "public_read_live_innings" on public.ls_innings;
create policy "public_read_live_completed_innings"
on public.ls_innings
for select
to anon, authenticated
using (
  exists (
    select 1 from public.ls_matches m
    where m.id = ls_innings.match_id
      and m.status in ('live'::public.match_status, 'completed'::public.match_status)
  )
);

-- 3. Match state: allow read for live AND completed matches
drop policy if exists "public_read_live_match_state" on public.ls_match_state;
create policy "public_read_live_completed_match_state"
on public.ls_match_state
for select
to anon, authenticated
using (
  exists (
    select 1 from public.ls_matches m
    where m.id = ls_match_state.match_id
      and m.status in ('live'::public.match_status, 'completed'::public.match_status)
  )
);

-- 4. Batting stats: NEW — allow read for live AND completed matches
drop policy if exists "public_read_batting_stats" on public.ls_batting_stats;
create policy "public_read_batting_stats"
on public.ls_batting_stats
for select
to anon, authenticated
using (
  exists (
    select 1 from public.ls_innings i
    join public.ls_matches m on m.id = i.match_id
    where i.id = ls_batting_stats.innings_id
      and m.status in ('live'::public.match_status, 'completed'::public.match_status)
  )
);

-- 5. Bowling stats: NEW — allow read for live AND completed matches
drop policy if exists "public_read_bowling_stats" on public.ls_bowling_stats;
create policy "public_read_bowling_stats"
on public.ls_bowling_stats
for select
to anon, authenticated
using (
  exists (
    select 1 from public.ls_innings i
    join public.ls_matches m on m.id = i.match_id
    where i.id = ls_bowling_stats.innings_id
      and m.status in ('live'::public.match_status, 'completed'::public.match_status)
  )
);

-- 6. Teams: also allow read for completed matches (for result pages)
drop policy if exists "public_read_teams_for_live" on public.teams;
create policy "public_read_teams_for_live_completed"
on public.teams
for select
to anon, authenticated
using (
  exists (
    select 1 from public.ls_matches m
    where m.status in ('live'::public.match_status, 'completed'::public.match_status)
      and (m.team_a_id = teams.id or m.team_b_id = teams.id)
  )
);

-- 7. Players: also allow read for completed matches
drop policy if exists "public_read_players_for_live" on public.players;
create policy "public_read_players_for_live_completed"
on public.players
for select
to anon, authenticated
using (
  exists (
    select 1 from public.ls_matches m
    where m.status in ('live'::public.match_status, 'completed'::public.match_status)
      and (m.team_a_id = players.team_id or m.team_b_id = players.team_id)
  )
);

-- 8. Tournaments: allow public read for all tournaments
drop policy if exists "public_read_tournaments" on public.ls_tournaments;
create policy "public_read_tournaments"
on public.ls_tournaments
for select
to anon, authenticated
using (true);

-- 9. Tournament teams: allow public read
drop policy if exists "public_read_tournament_teams" on public.ls_tournament_teams;
create policy "public_read_tournament_teams"
on public.ls_tournament_teams
for select
to anon, authenticated
using (true);

-- 10. Balls: allow public read for live/completed (for over tape display)
drop policy if exists "public_read_balls" on public.ls_balls;
create policy "public_read_balls"
on public.ls_balls
for select
to anon, authenticated
using (
  exists (
    select 1 from public.ls_innings i
    join public.ls_matches m on m.id = i.match_id
    where i.id = ls_balls.innings_id
      and m.status in ('live'::public.match_status, 'completed'::public.match_status)
  )
);

commit;
