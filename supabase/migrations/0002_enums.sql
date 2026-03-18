begin;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'player_status') then
    create type public.player_status as enum ('upcoming', 'active', 'sold', 'unsold', 'retired');
  end if;

  if not exists (select 1 from pg_type where typname = 'auction_phase') then
    create type public.auction_phase as enum ('not_started', 'registration', 'bidding', 'completed', 'cancelled');
  end if;

  if not exists (select 1 from pg_type where typname = 'match_status') then
    create type public.match_status as enum ('scheduled', 'live', 'completed', 'cancelled');
  end if;

  if not exists (select 1 from pg_type where typname = 'innings_status') then
    create type public.innings_status as enum ('not_started', 'in_progress', 'completed');
  end if;

  if not exists (select 1 from pg_type where typname = 'wicket_type') then
    create type public.wicket_type as enum (
      'bowled',
      'caught',
      'lbw',
      'run_out',
      'stumped',
      'hit_wicket',
      'obstructing_field',
      'retired_hurt',
      'timed_out'
    );
  end if;
end $$;

commit;
