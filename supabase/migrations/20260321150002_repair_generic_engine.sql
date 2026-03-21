begin;

-- Ensure sport enum exists
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'sport_type'
      and n.nspname = 'public'
  ) then
    create type public.sport_type as enum ('cricket', 'football', 'badminton');
  end if;
end $$;

-- Ensure ls_events exists with required columns
create table if not exists public.ls_events (
  id bigserial primary key,
  match_id uuid references public.ls_matches(id) on delete cascade,
  sport public.sport_type,
  type text,
  payload jsonb,
  created_at timestamptz default now()
);

alter table public.ls_events
  add column if not exists match_id uuid,
  add column if not exists sport public.sport_type,
  add column if not exists type text,
  add column if not exists payload jsonb,
  add column if not exists created_at timestamptz default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ls_events_match_id_fkey'
      and conrelid = 'public.ls_events'::regclass
  ) then
    alter table public.ls_events
      add constraint ls_events_match_id_fkey
      foreign key (match_id) references public.ls_matches(id) on delete cascade;
  end if;
end $$;

-- Ensure snapshot generic columns exist
alter table if exists public.ls_match_state
  add column if not exists state jsonb,
  add column if not exists is_paused boolean default false;

-- Realtime/log read policy safety
alter table public.ls_events enable row level security;
drop policy if exists "public read events" on public.ls_events;
create policy "public read events"
on public.ls_events for select
using (true);

-- Generic cricket fallback
create or replace function public.rpc_process_cricket_generic(
  p_match_id uuid,
  p_type text,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.ls_events(match_id, sport, type, payload)
  values (p_match_id, 'cricket', p_type, p_payload);
end;
$$;

-- Generic dispatcher (canonical signature used by app)
create or replace function public.rpc_process_event(
  p_match_id uuid,
  p_type text,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sport public.sport_type;
begin
  -- Canonical source: tournament.sport (ls_matches has no sport column)
  select t.sport::public.sport_type
  into v_sport
  from public.ls_matches m
  join public.ls_tournaments t on t.id = m.tournament_id
  where m.id = p_match_id;

  if v_sport is null then
    raise exception 'match % not found or has no sport', p_match_id;
  end if;

  if v_sport = 'cricket' then
    perform public.rpc_process_cricket_generic(p_match_id, p_type, p_payload);
  elsif v_sport = 'football' then
    perform public.rpc_process_football(p_match_id, p_type, p_payload);
  elsif v_sport = 'badminton' then
    perform public.rpc_process_badminton(p_match_id, p_type, p_payload);
  else
    raise exception 'unsupported sport %', v_sport;
  end if;
end;
$$;

grant execute on function public.rpc_process_event(uuid, text, jsonb) to anon, authenticated, service_role;

commit;

