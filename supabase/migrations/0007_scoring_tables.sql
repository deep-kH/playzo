begin;

create table if not exists public.ls_balls (
  id uuid primary key default gen_random_uuid(),
  innings_id uuid not null references public.ls_innings(id) on delete cascade,
  over_number smallint not null,
  ball_number smallint not null,
  sequence integer not null,
  batter_id uuid not null references public.players(id) on delete restrict,
  non_striker_id uuid not null references public.players(id) on delete restrict,
  bowler_id uuid not null references public.players(id) on delete restrict,
  runs_bat smallint not null default 0,
  runs_extra smallint not null default 0,
  extra_type text,
  is_wicket boolean not null default false,
  wicket_type public.wicket_type,
  wicket_player_id uuid references public.players(id) on delete set null,
  fielder_id uuid references public.players(id) on delete set null,
  is_legal boolean not null default true,
  created_at timestamptz not null default now(),
  unique (innings_id, sequence),
  check (runs_bat >= 0 and runs_extra >= 0),
  check (
    extra_type is null
    or extra_type in ('wide', 'no_ball', 'bye', 'leg_bye', 'penalty')
  )
);

create table if not exists public.ls_batting_stats (
  id uuid primary key default gen_random_uuid(),
  innings_id uuid not null references public.ls_innings(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete restrict,
  runs integer not null default 0,
  balls_faced integer not null default 0,
  fours integer not null default 0,
  sixes integer not null default 0,
  is_out boolean not null default false,
  dismissal_type public.wicket_type,
  dismissal_bowler_id uuid references public.players(id) on delete set null,
  dismissal_fielder_id uuid references public.players(id) on delete set null,
  batting_position smallint,
  unique (innings_id, player_id)
);

create table if not exists public.ls_bowling_stats (
  id uuid primary key default gen_random_uuid(),
  innings_id uuid not null references public.ls_innings(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete restrict,
  overs numeric not null default 0,
  maidens integer not null default 0,
  runs_conceded integer not null default 0,
  wickets integer not null default 0,
  wides integer not null default 0,
  no_balls integer not null default 0,
  dot_balls integer not null default 0,
  unique (innings_id, player_id)
);

create table if not exists public.ls_match_state (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references public.ls_matches(id) on delete cascade,
  current_innings_id uuid references public.ls_innings(id) on delete set null,
  striker_id uuid references public.players(id) on delete set null,
  non_striker_id uuid references public.players(id) on delete set null,
  current_bowler_id uuid references public.players(id) on delete set null,
  current_over smallint not null default 0,
  current_ball smallint not null default 0,
  last_ball_id uuid references public.ls_balls(id) on delete set null,
  partnership_runs integer not null default 0,
  partnership_balls integer not null default 0,
  score_runs integer not null default 0,
  score_wickets integer not null default 0,
  score_overs numeric not null default 0,
  score_extras integer not null default 0,
  balls_this_over jsonb default '[]'::jsonb,
  striker_snapshot jsonb,
  non_striker_snapshot jsonb,
  bowler_snapshot jsonb,
  last_event text,
  target_score integer,
  updated_at timestamptz not null default now()
);

commit;
