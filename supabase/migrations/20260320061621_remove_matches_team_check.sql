-- Drop the check constraint that prevents team_a_id and team_b_id from being the same.
-- For individual sports like badminton where players are selected individually 
-- but derived team IDs are used to satisfy the NOT NULL foreign key constraint,
-- players can be from the same team/club, resulting in the same team IDs.

ALTER TABLE public.ls_matches
DROP CONSTRAINT IF EXISTS ls_matches_check;
