-- Fix Maiden overs calculation and Bowler Runs conceded (byes/leg byes do not count)

-- 1. Redefine process_ball to handle maidens and correct bowler runs
CREATE OR REPLACE FUNCTION public.process_ball(
  p_match_id uuid,
  p_runs_bat integer,
  p_runs_extra integer,
  p_extra_type text,
  p_is_wicket boolean,
  p_wicket_type public.wicket_type,
  p_wicket_player_id uuid,
  p_fielder_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_state public.ls_match_state%rowtype;
  v_innings public.ls_innings%rowtype;
  v_match public.ls_matches%rowtype;
  v_seq integer;
  v_over smallint;
  v_ball smallint;
  v_is_legal boolean;
  v_total_runs integer;
  v_bowler_runs integer;
  v_over_runs integer;
  v_batting_row public.ls_batting_stats%rowtype;
  v_bowling_row public.ls_bowling_stats%rowtype;
  v_ball_id uuid;
  v_last_over_balls jsonb;
  v_stats jsonb;
  v_crr numeric;
  v_rrr numeric;
  v_projected_score integer;
  v_max_overs numeric;
  v_players_per_team integer;
  v_real_overs numeric;
  v_real_max_overs numeric;
  v_bowler_gets_wicket boolean;
  v_target_wicket_player uuid;

  l_runs_bat integer := coalesce(p_runs_bat, 0);
  l_runs_extra integer := coalesce(p_runs_extra, 0);
  l_is_wicket boolean := coalesce(p_is_wicket, false);

  v_swap_strike boolean := false;
  v_over_complete boolean := false;
  v_innings_ended boolean := false;
  v_match_ended boolean := false;
  v_new_striker uuid;
  v_new_non_striker uuid;
  v_bowls integer;
BEGIN
  IF l_runs_bat < 0 OR l_runs_extra < 0 THEN
    RAISE EXCEPTION 'runs cannot be negative';
  END IF;

  SELECT * INTO v_state
  FROM public.ls_match_state
  WHERE match_id = p_match_id
  FOR UPDATE;

  IF v_state.match_id IS NULL THEN
    RAISE EXCEPTION 'match_state missing for match %', p_match_id;
  END IF;
  IF v_state.current_innings_id IS NULL THEN
    RAISE EXCEPTION 'current innings not set for match %', p_match_id;
  END IF;
  IF v_state.striker_id IS NULL OR v_state.non_striker_id IS NULL OR v_state.current_bowler_id IS NULL THEN
    RAISE EXCEPTION 'striker/non_striker/bowler not set for match %', p_match_id;
  END IF;

  SELECT * INTO v_innings
  FROM public.ls_innings
  WHERE id = v_state.current_innings_id
  FOR UPDATE;

  IF v_innings.status <> 'in_progress'::public.innings_status THEN
    RAISE EXCEPTION 'innings % not in progress', v_innings.id;
  END IF;

  SELECT * INTO v_match FROM public.ls_matches WHERE id = p_match_id;
  v_max_overs := coalesce((v_match.settings->>'overs_per_innings')::numeric, (v_match.settings->>'overs')::numeric, 20);
  v_players_per_team := coalesce((v_match.settings->>'players_per_team')::integer, 11);

  v_is_legal := NOT (coalesce(p_extra_type, '') IN ('wide', 'no_ball'));

  SELECT coalesce(max(sequence), 0) + 1 INTO v_seq
  FROM public.ls_balls WHERE innings_id = v_innings.id;

  v_over := v_state.current_over;
  v_ball := v_state.current_ball + 1;
  v_total_runs := l_runs_bat + l_runs_extra;
  
  IF coalesce(p_extra_type, '') IN ('bye', 'leg_bye') THEN
    v_bowler_runs := 0;
  ELSE
    v_bowler_runs := v_total_runs;
  END IF;

  -- INSERT BALL RECORD
  INSERT INTO public.ls_balls (
    innings_id, over_number, ball_number, sequence,
    batter_id, non_striker_id, bowler_id,
    runs_bat, runs_extra, extra_type,
    is_wicket, wicket_type, wicket_player_id, fielder_id, is_legal
  ) VALUES (
    v_innings.id, v_over, v_ball, v_seq,
    v_state.striker_id, v_state.non_striker_id, v_state.current_bowler_id,
    l_runs_bat, l_runs_extra, nullif(p_extra_type, ''),
    l_is_wicket, p_wicket_type, p_wicket_player_id, p_fielder_id, v_is_legal
  ) RETURNING id INTO v_ball_id;

  PERFORM public._ensure_batting_row(v_innings.id, v_state.striker_id);
  PERFORM public._ensure_batting_row(v_innings.id, v_state.non_striker_id);
  PERFORM public._ensure_bowling_row(v_innings.id, v_state.current_bowler_id);

  -- UPDATE BATTING STATS
  UPDATE public.ls_batting_stats
  SET runs = runs + l_runs_bat,
      balls_faced = balls_faced + CASE WHEN v_is_legal THEN 1 ELSE 0 END,
      fours = fours + CASE WHEN l_runs_bat = 4 THEN 1 ELSE 0 END,
      sixes = sixes + CASE WHEN l_runs_bat = 6 THEN 1 ELSE 0 END
  WHERE innings_id = v_innings.id AND player_id = v_state.striker_id;

  -- Determine if bowler gets credit for the wicket
  v_bowler_gets_wicket := l_is_wicket AND coalesce(p_wicket_type::text, '') NOT IN ('run_out', 'retired_hurt', 'timed_out', 'obstructing');

  -- WICKET HANDLING
  IF l_is_wicket THEN
    v_target_wicket_player := coalesce(p_wicket_player_id, v_state.striker_id);
    
    UPDATE public.ls_batting_stats
    SET is_out = true,
        dismissal_type = p_wicket_type,
        dismissal_bowler_id = v_state.current_bowler_id,
        dismissal_fielder_id = p_fielder_id
    WHERE innings_id = v_innings.id
      AND player_id = v_target_wicket_player;

    IF v_bowler_gets_wicket THEN
      UPDATE public.ls_bowling_stats
      SET wickets = wickets + 1
      WHERE innings_id = v_innings.id AND player_id = v_state.current_bowler_id;
    END IF;

    UPDATE public.ls_innings
    SET total_wickets = total_wickets + 1
    WHERE id = v_innings.id;
  END IF;

  -- BOWLING STATS (recalculate overs from legal deliveries)
  SELECT count(*) INTO v_bowls
  FROM public.ls_balls
  WHERE innings_id = v_innings.id
    AND bowler_id = v_state.current_bowler_id
    AND is_legal = true;

  UPDATE public.ls_bowling_stats
  SET runs_conceded = runs_conceded + v_bowler_runs,
      wides = wides + CASE WHEN p_extra_type = 'wide' THEN 1 ELSE 0 END,
      no_balls = no_balls + CASE WHEN p_extra_type = 'no_ball' THEN 1 ELSE 0 END,
      dot_balls = dot_balls + CASE WHEN v_is_legal AND v_total_runs = 0 AND NOT l_is_wicket THEN 1 ELSE 0 END,
      overs = (v_bowls / 6) + ((v_bowls % 6)::numeric / 10)
  WHERE innings_id = v_innings.id AND player_id = v_state.current_bowler_id;

  UPDATE public.ls_innings
  SET total_runs = total_runs + v_total_runs,
      total_extras = total_extras + l_runs_extra
  WHERE id = v_innings.id;

  -- =========================================================
  -- STRIKE ROTATION & WICKET RESOLUTION
  -- =========================================================
  
  -- 1. Determine run-based strike rotation
  v_swap_strike := false;
  IF coalesce(p_extra_type, '') = '' THEN
    v_swap_strike := (l_runs_bat % 2) = 1;
  ELSIF p_extra_type = 'wide' THEN
    v_swap_strike := ((l_runs_extra - 1) % 2) = 1;
  ELSIF p_extra_type = 'no_ball' THEN
    v_swap_strike := (l_runs_bat % 2) = 1;
  ELSIF p_extra_type IN ('bye', 'leg_bye') THEN
    v_swap_strike := (l_runs_extra % 2) = 1;
  END IF;

  IF v_swap_strike THEN
    v_new_striker := v_state.non_striker_id;
    v_new_non_striker := v_state.striker_id;
  ELSE
    v_new_striker := v_state.striker_id;
    v_new_non_striker := v_state.non_striker_id;
  END IF;

  -- 2. Nullify the player who got out BEFORE the over swap
  IF l_is_wicket THEN
    IF v_new_striker = coalesce(p_wicket_player_id, v_state.striker_id) THEN
      v_new_striker := NULL;
      -- Reset partnership
      UPDATE public.ls_match_state SET partnership_runs = 0, partnership_balls = 0 WHERE match_id = p_match_id;
    ELSIF v_new_non_striker = coalesce(p_wicket_player_id, v_state.striker_id) THEN
      v_new_non_striker := NULL;
      -- Reset partnership
      UPDATE public.ls_match_state SET partnership_runs = 0, partnership_balls = 0 WHERE match_id = p_match_id;
    END IF;
  END IF;

  -- Build balls_this_over payload
  v_last_over_balls := coalesce(v_state.balls_this_over, '[]'::jsonb)
    || jsonb_build_array(jsonb_build_object(
      'over_number', v_over, 'ball_number', v_ball,
      'runs_bat', l_runs_bat, 'runs_extra', l_runs_extra,
      'extra_type', nullif(p_extra_type,''),
      'is_wicket', l_is_wicket, 'is_legal', v_is_legal
    ));

  -- 3. End of Over Swap (only applies if ball is legal and it's the 6th ball)
  IF v_is_legal AND v_state.current_ball = 5 THEN
    v_over_complete := true;
    
    -- CHECK FOR MAIDEN OVER
    SELECT COALESCE(SUM(
      CASE WHEN coalesce(extra_type, '') IN ('bye', 'leg_bye') THEN 0
      ELSE runs_bat + runs_extra END
    ), 0) INTO v_over_runs
    FROM public.ls_balls
    WHERE innings_id = v_innings.id
      AND bowler_id = v_state.current_bowler_id
      AND over_number = v_over;

    IF v_over_runs = 0 THEN
      UPDATE public.ls_bowling_stats
      SET maidens = maidens + 1
      WHERE innings_id = v_innings.id AND player_id = v_state.current_bowler_id;
    END IF;
    
    DECLARE v_temp uuid;
    BEGIN
      v_temp := v_new_striker;
      v_new_striker := v_new_non_striker;
      v_new_non_striker := v_temp;
    END;
  END IF;

  -- =========================================================
  -- SINGLE DB STATE UPDATE
  -- =========================================================
  IF v_is_legal THEN
    IF v_over_complete THEN
      UPDATE public.ls_match_state
      SET current_over = current_over + 1,
          current_ball = 0,
          last_ball_id = v_ball_id,
          balls_this_over = '[]'::jsonb,
          partnership_runs = partnership_runs + v_total_runs,
          partnership_balls = partnership_balls + 1,
          score_runs = score_runs + v_total_runs,
          score_extras = score_extras + l_runs_extra,
          score_wickets = score_wickets + CASE WHEN l_is_wicket THEN 1 ELSE 0 END,
          score_overs = (current_over + 1)::numeric,
          last_event = CASE WHEN l_is_wicket THEN 'wicket' ELSE 'over_complete' END,
          current_bowler_id = NULL,
          striker_id = v_new_striker,
          non_striker_id = v_new_non_striker
      WHERE match_id = p_match_id;
    ELSE
      UPDATE public.ls_match_state
      SET current_ball = current_ball + 1,
          last_ball_id = v_ball_id,
          balls_this_over = v_last_over_balls,
          partnership_runs = partnership_runs + v_total_runs,
          partnership_balls = partnership_balls + 1,
          score_runs = score_runs + v_total_runs,
          score_extras = score_extras + l_runs_extra,
          score_wickets = score_wickets + CASE WHEN l_is_wicket THEN 1 ELSE 0 END,
          score_overs = (current_over + ((current_ball + 1)::numeric / 10)),
          last_event = CASE WHEN l_is_wicket THEN 'wicket' ELSE 'ball' END,
          striker_id = v_new_striker,
          non_striker_id = v_new_non_striker
      WHERE match_id = p_match_id;
    END IF;
  ELSE
    UPDATE public.ls_match_state
    SET last_ball_id = v_ball_id,
        balls_this_over = v_last_over_balls,
        partnership_runs = partnership_runs + v_total_runs,
        score_runs = score_runs + v_total_runs,
        score_extras = score_extras + l_runs_extra,
        last_event = 'extra',
        striker_id = v_new_striker,
        non_striker_id = v_new_non_striker
    WHERE match_id = p_match_id;
  END IF;

  -- RE-READ STATE & INNINGS
  SELECT * INTO v_state FROM public.ls_match_state WHERE match_id = p_match_id;
  UPDATE public.ls_innings SET total_overs = v_state.score_overs WHERE id = v_innings.id;
  SELECT * INTO v_innings FROM public.ls_innings WHERE id = v_state.current_innings_id;

  -- INNINGS END DETECTION
  IF v_innings.total_wickets >= (v_players_per_team - 1) THEN
    v_innings_ended := true;
  END IF;
  IF v_state.score_overs >= v_max_overs THEN
    v_innings_ended := true;
  END IF;
  IF v_state.target_score IS NOT NULL AND v_innings.total_runs >= v_state.target_score THEN
    v_innings_ended := true;
    v_match_ended := true;
  END IF;

  IF v_innings_ended THEN
    UPDATE public.ls_innings SET status = 'completed'::public.innings_status WHERE id = v_innings.id;
    IF v_innings.innings_number = 1 AND NOT v_match_ended THEN
      UPDATE public.ls_match_state SET last_event = 'innings_ended' WHERE match_id = p_match_id;
    ELSE
      v_match_ended := true;
    END IF;
  END IF;

  IF v_match_ended THEN
    UPDATE public.ls_matches SET status = 'completed'::public.match_status WHERE id = p_match_id;
    UPDATE public.ls_match_state SET last_event = 'match_completed' WHERE match_id = p_match_id;
  END IF;

  -- SNAPSHOTS & STATS (using real overs for rate calculations)
  SELECT * INTO v_batting_row FROM public.ls_batting_stats WHERE innings_id = v_innings.id AND player_id = v_state.striker_id;
  SELECT * INTO v_bowling_row FROM public.ls_bowling_stats WHERE innings_id = v_innings.id AND player_id = v_state.current_bowler_id;

  v_real_overs := public._to_real_overs(v_state.score_overs);
  v_real_max_overs := public._to_real_overs(v_max_overs);

  IF v_real_overs > 0 THEN
    v_crr := (v_state.score_runs::numeric / v_real_overs)::numeric(5,2);
  ELSE
    v_crr := 0;
  END IF;

  v_rrr := NULL;
  IF v_state.target_score IS NOT NULL AND v_real_overs < v_real_max_overs THEN
    IF (v_real_max_overs - v_real_overs) > 0 THEN
      v_rrr := ((v_state.target_score - v_state.score_runs)::numeric / (v_real_max_overs - v_real_overs))::numeric(5,2);
    END IF;
  END IF;

  v_projected_score := NULL;
  IF v_innings.innings_number = 1 AND v_real_overs >= 2 THEN
    v_projected_score := ((v_state.score_runs::numeric / v_real_overs) * v_real_max_overs)::integer;
  END IF;

  v_stats := jsonb_build_object('crr', v_crr, 'rrr', v_rrr, 'projected_score', v_projected_score, 'partnership_runs', v_state.partnership_runs, 'partnership_balls', v_state.partnership_balls);

  UPDATE public.ls_match_state
  SET striker_snapshot = to_jsonb(v_batting_row),
      bowler_snapshot = (CASE WHEN v_bowling_row IS NULL THEN NULL ELSE to_jsonb(v_bowling_row) || jsonb_build_object(
        'economy', CASE WHEN coalesce(public._to_real_overs(v_bowling_row.overs), 0) > 0
          THEN (v_bowling_row.runs_conceded::numeric / public._to_real_overs(v_bowling_row.overs))::numeric(5,2)
          ELSE 0 END
      ) END),
      stats = v_stats
  WHERE match_id = p_match_id;
END;
$func$;


-- 2. Redefine undo_last_ball to revert maidens and bowler runs
CREATE OR REPLACE FUNCTION public.undo_last_ball(p_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_state public.ls_match_state%rowtype;
  v_innings public.ls_innings%rowtype;
  v_ball public.ls_balls%rowtype;
  v_total_runs integer;
  v_bowler_runs integer;
  v_over_runs integer;
  v_was_maiden boolean := false;
  v_is_legal boolean;
BEGIN
  SELECT * INTO v_state
  FROM public.ls_match_state
  WHERE match_id = p_match_id
  FOR UPDATE;

  IF v_state.last_ball_id IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_ball
  FROM public.ls_balls
  WHERE id = v_state.last_ball_id
  FOR UPDATE;

  IF v_ball.id IS NULL THEN
    UPDATE public.ls_match_state SET last_ball_id = NULL WHERE match_id = p_match_id;
    RETURN;
  END IF;

  SELECT * INTO v_innings
  FROM public.ls_innings
  WHERE id = v_ball.innings_id
  FOR UPDATE;

  v_total_runs := v_ball.runs_bat + v_ball.runs_extra;
  v_is_legal := v_ball.is_legal;
  
  IF coalesce(v_ball.extra_type, '') IN ('bye', 'leg_bye') THEN
    v_bowler_runs := 0;
  ELSE
    v_bowler_runs := v_total_runs;
  END IF;

  IF v_ball.is_legal AND v_ball.ball_number = 6 THEN
    SELECT COALESCE(SUM(
      CASE WHEN coalesce(extra_type, '') IN ('bye', 'leg_bye') THEN 0
      ELSE runs_bat + runs_extra END
    ), 0) INTO v_over_runs
    FROM public.ls_balls
    WHERE innings_id = v_innings.id
      AND bowler_id = v_ball.bowler_id
      AND over_number = v_ball.over_number;

    IF v_over_runs = 0 THEN
      v_was_maiden := true;
    END IF;
  END IF;

  -- Reverse batting stats
  UPDATE public.ls_batting_stats
  SET runs = greatest(0, runs - v_ball.runs_bat),
      balls_faced = greatest(0, balls_faced - CASE WHEN v_is_legal THEN 1 ELSE 0 END),
      fours = greatest(0, fours - CASE WHEN v_ball.runs_bat = 4 THEN 1 ELSE 0 END),
      sixes = greatest(0, sixes - CASE WHEN v_ball.runs_bat = 6 THEN 1 ELSE 0 END)
  WHERE innings_id = v_innings.id AND player_id = v_ball.batter_id;

  -- Reverse wicket
  IF v_ball.is_wicket THEN
    UPDATE public.ls_batting_stats
    SET is_out = false, dismissal_type = NULL, dismissal_bowler_id = NULL, dismissal_fielder_id = NULL
    WHERE innings_id = v_innings.id
      AND player_id = coalesce(v_ball.wicket_player_id, v_ball.batter_id);

    -- Only revert bowler wicket if it actually counted for the bowler
    IF coalesce(v_ball.wicket_type::text, '') NOT IN ('run_out', 'retired_hurt', 'timed_out', 'obstructing') THEN
      UPDATE public.ls_bowling_stats
      SET wickets = greatest(0, wickets - 1)
      WHERE innings_id = v_innings.id AND player_id = v_ball.bowler_id;
    END IF;

    UPDATE public.ls_innings
    SET total_wickets = greatest(0, total_wickets - 1)
    WHERE id = v_innings.id;

    -- If innings was completed, revert to in_progress
    UPDATE public.ls_innings
    SET status = 'in_progress'::public.innings_status
    WHERE id = v_innings.id AND status = 'completed'::public.innings_status;

    -- If match was completed, revert to live
    UPDATE public.ls_matches
    SET status = 'live'::public.match_status
    WHERE id = p_match_id AND status = 'completed'::public.match_status;
  END IF;

  -- Reverse bowling stats
  UPDATE public.ls_bowling_stats
  SET runs_conceded = greatest(0, runs_conceded - v_bowler_runs),
      wides = greatest(0, wides - CASE WHEN v_ball.extra_type = 'wide' THEN 1 ELSE 0 END),
      no_balls = greatest(0, no_balls - CASE WHEN v_ball.extra_type = 'no_ball' THEN 1 ELSE 0 END),
      dot_balls = greatest(0, dot_balls - CASE WHEN v_is_legal AND v_total_runs = 0 AND NOT v_ball.is_wicket THEN 1 ELSE 0 END),
      maidens = greatest(0, maidens - CASE WHEN v_was_maiden THEN 1 ELSE 0 END)
  WHERE innings_id = v_innings.id AND player_id = v_ball.bowler_id;

  -- Reverse innings totals
  UPDATE public.ls_innings
  SET total_runs = greatest(0, total_runs - v_total_runs),
      total_extras = greatest(0, total_extras - v_ball.runs_extra)
  WHERE id = v_innings.id;

  -- Delete ball
  DELETE FROM public.ls_balls WHERE id = v_ball.id;

  -- =============================================
  -- RESTORE STATE: Striker/non-striker from ball record, bowler from ball
  -- =============================================
  UPDATE public.ls_match_state
  SET striker_id = v_ball.batter_id,
      non_striker_id = v_ball.non_striker_id,
      current_bowler_id = v_ball.bowler_id,
      current_innings_id = v_ball.innings_id
  WHERE match_id = p_match_id;

  -- Recompute over/ball from remaining balls
  WITH last_legal AS (
    SELECT over_number, ball_number
    FROM public.ls_balls
    WHERE innings_id = v_innings.id AND is_legal = true
    ORDER BY sequence DESC LIMIT 1
  )
  UPDATE public.ls_match_state ms
  SET current_over = coalesce((SELECT over_number FROM last_legal), 0),
      current_ball = coalesce((SELECT ball_number FROM last_legal), 0) % 6,
      last_ball_id = (SELECT id FROM public.ls_balls WHERE innings_id = v_innings.id ORDER BY sequence DESC LIMIT 1),
      balls_this_over = coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'over_number', over_number, 'ball_number', ball_number,
          'runs_bat', runs_bat, 'runs_extra', runs_extra,
          'extra_type', extra_type, 'is_wicket', is_wicket, 'is_legal', is_legal
        ) ORDER BY sequence ASC)
        FROM public.ls_balls
        WHERE innings_id = v_innings.id AND over_number = coalesce((SELECT over_number FROM last_legal), 0)
      ), '[]'::jsonb),
      partnership_runs = greatest(0, partnership_runs - v_total_runs),
      partnership_balls = greatest(0, partnership_balls - CASE WHEN v_is_legal THEN 1 ELSE 0 END),
      score_runs = greatest(0, score_runs - v_total_runs),
      score_extras = greatest(0, score_extras - v_ball.runs_extra),
      score_wickets = greatest(0, score_wickets - CASE WHEN v_ball.is_wicket THEN 1 ELSE 0 END),
      score_overs = (coalesce((SELECT over_number FROM last_legal), 0)::numeric
        + (coalesce((SELECT ball_number FROM last_legal), 0) % 6)::numeric / 10),
      last_event = 'undo'
  WHERE ms.match_id = p_match_id;

  -- Recompute bowler overs
  DECLARE 
    v_bowls integer;
  BEGIN
    SELECT count(*) INTO v_bowls
    FROM public.ls_balls
    WHERE innings_id = v_innings.id
      AND bowler_id = v_ball.bowler_id
      AND is_legal = true;

    UPDATE public.ls_bowling_stats
    SET overs = (v_bowls / 6) + ((v_bowls % 6)::numeric / 10)
    WHERE innings_id = v_innings.id AND player_id = v_ball.bowler_id;
  END;

  UPDATE public.ls_innings
  SET total_overs = (SELECT score_overs FROM public.ls_match_state WHERE match_id = p_match_id)
  WHERE id = v_innings.id;
END;
$func$;
