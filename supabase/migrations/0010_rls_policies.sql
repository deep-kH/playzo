begin;

-- Enable RLS on all app tables
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.ls_tournaments enable row level security;
alter table public.ls_tournament_teams enable row level security;
alter table public.ls_matches enable row level security;
alter table public.ls_innings enable row level security;
alter table public.ls_balls enable row level security;
alter table public.ls_batting_stats enable row level security;
alter table public.ls_bowling_stats enable row level security;
alter table public.ls_match_state enable row level security;

-- Profiles
drop policy if exists "profiles_self_read" on public.profiles;
create policy "profiles_self_read"
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update"
on public.profiles
for update
to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

-- Admin: full access everywhere
do $$
declare
  t text;
begin
  foreach t in array array[
    'teams','players','ls_tournaments','ls_tournament_teams',
    'ls_matches','ls_innings','ls_balls','ls_batting_stats','ls_bowling_stats','ls_match_state'
  ]
  loop
    execute format('drop policy if exists admin_all_%s on public.%I', t, t);
    execute format($p$
      create policy admin_all_%s
      on public.%I
      for all
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
    $p$, t, t);
  end loop;
end $$;

-- Public (anon + authenticated non-admin): read-only live match data
-- Matches
drop policy if exists "public_read_live_matches" on public.ls_matches;
create policy "public_read_live_matches"
on public.ls_matches
for select
to anon, authenticated
using (status = 'live'::public.match_status);

-- Innings (only for live matches)
drop policy if exists "public_read_live_innings" on public.ls_innings;
create policy "public_read_live_innings"
on public.ls_innings
for select
to anon, authenticated
using (
  exists (
    select 1 from public.ls_matches m
    where m.id = ls_innings.match_id
      and m.status = 'live'::public.match_status
  )
);

-- Match state (only for live matches)
drop policy if exists "public_read_live_match_state" on public.ls_match_state;
create policy "public_read_live_match_state"
on public.ls_match_state
for select
to anon, authenticated
using (
  exists (
    select 1 from public.ls_matches m
    where m.id = ls_match_state.match_id
      and m.status = 'live'::public.match_status
  )
);

-- Optional public reads to render the live UI (teams/players for those live matches).
-- This keeps the system usable without exposing write paths.
drop policy if exists "public_read_teams_for_live" on public.teams;
create policy "public_read_teams_for_live"
on public.teams
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.ls_matches m
    where m.status = 'live'::public.match_status
      and (m.team_a_id = teams.id or m.team_b_id = teams.id)
  )
);

drop policy if exists "public_read_players_for_live" on public.players;
create policy "public_read_players_for_live"
on public.players
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.ls_matches m
    where m.status = 'live'::public.match_status
      and (
        m.team_a_id = players.team_id
        or m.team_b_id = players.team_id
      )
  )
);

-- Everything else: no public access (admins still have full via policy above)
commit;
