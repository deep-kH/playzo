begin;

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid,
  name text not null,
  manager text default '',
  purse_remaining numeric default 0,
  slots_remaining integer default 0,
  captain_id uuid,
  logo_url text,
  sport text,
  created_at timestamptz not null default now()
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid,
  team_id uuid references public.teams(id) on delete set null,
  name text not null,
  role text not null,
  status public.player_status not null default 'upcoming',
  sold_price numeric,
  sold_team_id uuid references public.teams(id) on delete set null,
  jersey_number integer,
  photo_url text,
  is_captain boolean default false,
  is_blind_bid boolean default false,
  created_at timestamptz not null default now()
);

-- Add captain FK after players exist (avoids cycle at create time)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'teams_captain_id_fkey'
  ) then
    alter table public.teams
      add constraint teams_captain_id_fkey
      foreign key (captain_id) references public.players(id)
      on delete set null
      deferrable initially deferred;
  end if;
end $$;

commit;
