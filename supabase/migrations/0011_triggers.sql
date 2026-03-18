begin;

-- Updated-at trigger helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Apply updated_at maintenance
drop trigger if exists trg_ls_matches_updated_at on public.ls_matches;
create trigger trg_ls_matches_updated_at
before update on public.ls_matches
for each row execute function public.set_updated_at();

drop trigger if exists trg_ls_tournaments_updated_at on public.ls_tournaments;
create trigger trg_ls_tournaments_updated_at
before update on public.ls_tournaments
for each row execute function public.set_updated_at();

-- Match state uses updated_at as "last changed" and is updated frequently.
create or replace function public.touch_match_state_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_ls_match_state_touch on public.ls_match_state;
create trigger trg_ls_match_state_touch
before update on public.ls_match_state
for each row execute function public.touch_match_state_updated_at();

-- Auto-create match_state when a match is created
create or replace function public.create_match_state_for_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.ls_match_state (match_id)
  values (new.id)
  on conflict (match_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_ls_matches_create_state on public.ls_matches;
create trigger trg_ls_matches_create_state
after insert on public.ls_matches
for each row execute function public.create_match_state_for_match();

commit;
