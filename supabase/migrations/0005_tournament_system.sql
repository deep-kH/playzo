begin;

create table if not exists public.ls_tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sport text not null check (sport in ('cricket', 'football', 'badminton')),
  location text,
  start_date date,
  end_date date,
  status text not null default 'upcoming' check (status in ('upcoming', 'active', 'completed', 'cancelled')),
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ls_tournament_teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.ls_tournaments(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (tournament_id, team_id)
);

commit;
