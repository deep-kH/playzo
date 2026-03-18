begin;

-- Create storage buckets (idempotent)
insert into storage.buckets (id, name, public)
values
  ('player-photos', 'player-photos', true),
  ('team-logos', 'team-logos', true)
on conflict (id) do nothing;

commit;
