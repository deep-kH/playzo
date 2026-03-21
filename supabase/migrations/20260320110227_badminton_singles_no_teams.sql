-- Make team_a_id and team_b_id nullable for badminton singles matches
-- (Singles matches have no teams, only individual players stored in settings.badminton_players)

ALTER TABLE public.ls_matches
  ALTER COLUMN team_a_id DROP NOT NULL,
  ALTER COLUMN team_b_id DROP NOT NULL;
