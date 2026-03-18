begin;

create table if not exists public.ls_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.ls_tournaments(id) on delete cascade,
  team_a_id uuid not null references public.teams(id) on delete restrict,
  team_b_id uuid not null references public.teams(id) on delete restrict,
  status public.match_status not null default 'scheduled',
  start_time timestamptz,
  venue text,
  settings jsonb not null default '{}'::jsonb,
  result jsonb,
  toss jsonb,
  playing_xi jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (team_a_id <> team_b_id)
);

create table if not exists public.ls_innings (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.ls_matches(id) on delete cascade,
  innings_number smallint not null check (innings_number in (1, 2)),
  batting_team_id uuid not null references public.teams(id) on delete restrict,
  bowling_team_id uuid not null references public.teams(id) on delete restrict,
  total_runs integer not null default 0,
  total_wickets integer not null default 0,
  -- Cricket-style overs encoding: 4.2 means 4 overs + 2 balls
  total_overs numeric not null default 0,
  total_extras integer not null default 0,
  status public.innings_status not null default 'not_started',
  created_at timestamptz not null default now(),
  unique (match_id, innings_number),
  check (batting_team_id <> bowling_team_id)
);

commit;
