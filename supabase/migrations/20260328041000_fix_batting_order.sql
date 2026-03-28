-- Fix batting order: auto-assign batting_position when a new batter row is created.
-- This ensures the scorecard displays batters in the order they came to bat.

CREATE OR REPLACE FUNCTION public._ensure_batting_row(p_innings_id uuid, p_player_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $func$
DECLARE
  v_next_pos smallint;
BEGIN
  -- Only insert if the row doesn't already exist
  IF NOT EXISTS (
    SELECT 1 FROM public.ls_batting_stats
    WHERE innings_id = p_innings_id AND player_id = p_player_id
  ) THEN
    -- Calculate the next batting position
    SELECT COALESCE(MAX(batting_position), 0) + 1
    INTO v_next_pos
    FROM public.ls_batting_stats
    WHERE innings_id = p_innings_id;

    INSERT INTO public.ls_batting_stats (innings_id, player_id, batting_position)
    VALUES (p_innings_id, p_player_id, v_next_pos);
  END IF;
END;
$func$;

-- Backfill any existing batting stats rows that have NULL batting_position.
-- Order by: dismissed players first (by their ball sequence), then active batters.
DO $$
DECLARE
  r RECORD;
  v_pos smallint;
  v_current_innings uuid := NULL;
BEGIN
  FOR r IN (
    SELECT bs.innings_id, bs.player_id, bs.id,
           COALESCE(
             (SELECT MIN(b.sequence) FROM public.ls_balls b
              WHERE b.innings_id = bs.innings_id
                AND (b.batter_id = bs.player_id OR b.non_striker_id = bs.player_id)),
             999999
           ) AS first_appearance
    FROM public.ls_batting_stats bs
    WHERE bs.batting_position IS NULL
    ORDER BY bs.innings_id, first_appearance, bs.id
  )
  LOOP
    IF v_current_innings IS DISTINCT FROM r.innings_id THEN
      v_current_innings := r.innings_id;
      -- Start from the max existing position for this innings (or 0)
      SELECT COALESCE(MAX(batting_position), 0) INTO v_pos
      FROM public.ls_batting_stats
      WHERE innings_id = r.innings_id AND batting_position IS NOT NULL;
    END IF;

    v_pos := v_pos + 1;

    UPDATE public.ls_batting_stats
    SET batting_position = v_pos
    WHERE id = r.id;
  END LOOP;
END;
$$;
