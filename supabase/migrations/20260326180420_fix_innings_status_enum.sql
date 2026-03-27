-- Fix: replace invalid enum value 'ended' with 'completed' in trg_sync_cricket_state
CREATE OR REPLACE FUNCTION public.trg_sync_cricket_state()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sport public.sport_type;
  v_match_status public.match_status;
  v_innings_status public.innings_status;
  v_innings_number smallint;
BEGIN
  -- Get match details by joining with tournaments
  SELECT t.sport::public.sport_type, m.status 
  INTO v_sport, v_match_status
  FROM public.ls_matches m
  JOIN public.ls_tournaments t ON t.id = m.tournament_id
  WHERE m.id = NEW.match_id;

  IF v_sport = 'cricket' THEN
    -- Get current innings details
    IF NEW.current_innings_id IS NOT NULL THEN
      SELECT status, innings_number INTO v_innings_status, v_innings_number
      FROM public.ls_innings
      WHERE id = NEW.current_innings_id;
    ELSE
      -- Fix: was 'ended' instead of 'completed'
      v_innings_status := 'completed'::public.innings_status;
      v_innings_number := 1;
    END IF;

    -- Rebuild the JSONB state for frontend backwards compatibility
    NEW.state := jsonb_build_object(
      'matchStatus', v_match_status,
      'inningsStatus', v_innings_status,
      'currentInningsNumber', coalesce(v_innings_number, 1),
      'target', NEW.target_score,
      'striker', NEW.striker_id,
      'nonStriker', NEW.non_striker_id,
      'bowler', NEW.current_bowler_id,
      'runs', coalesce(NEW.score_runs, 0),
      'wickets', coalesce(NEW.score_wickets, 0),
      'overs', coalesce(NEW.score_overs, 0),
      'extras', coalesce(NEW.score_extras, 0),
      'ballsInOver', coalesce(NEW.current_ball, 0),
      'lastEvent', NEW.last_event
    );
  END IF;

  RETURN NEW;
END;
$$;
