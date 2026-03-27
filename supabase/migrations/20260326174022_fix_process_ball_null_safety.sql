-- Redefine process_ball with better NULL safety for all input parameters
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
  v_batting_row public.ls_batting_stats%rowtype;
  v_bowling_row public.ls_bowling_stats%rowtype;
  v_ball_id uuid;
  v_last_over_balls jsonb;
  v_stats jsonb;
  v_crr numeric;
  v_rrr numeric;
  v_projected_score integer;
  v_max_overs numeric;
  
  -- Internal local copies for null safety
  l_runs_bat integer := coalesce(p_runs_bat, 0);
  l_runs_extra integer := coalesce(p_runs_extra, 0);
  l_is_wicket boolean := coalesce(p_is_wicket, false);
BEGIN
  IF l_runs_bat < 0 OR l_runs_extra < 0 THEN
    RAISE EXCEPTION 'runs cannot be negative';
  END IF;

  SELECT *
  INTO v_state
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

  SELECT *
  INTO v_innings
  FROM public.ls_innings
  WHERE id = v_state.current_innings_id
  FOR UPDATE;

  IF v_innings.status <> 'in_progress'::public.innings_status THEN
    RAISE EXCEPTION 'innings % not in progress', v_innings.id;
  END IF;

  -- Fetch match metadata (needed for max_overs check)
  SELECT *
  INTO v_match
  FROM public.ls_matches
  WHERE id = p_match_id;

  v_max_overs := coalesce((v_match.settings->>'overs')::numeric, 20);

  -- Determine legality: wides & no-balls are not legal deliveries.
  -- ✅ Fix: Ensure p_extra_type is coalesced to avoid NULL result from IN operator
  v_is_legal := NOT (coalesce(p_extra_type, '') IN ('wide', 'no_ball'));

  -- Sequence per innings
  SELECT coalesce(max(sequence), 0) + 1
  INTO v_seq
  FROM public.ls_balls
  WHERE innings_id = v_innings.id;

  v_over := v_state.current_over;
  v_ball := v_state.current_ball + 1; -- ball number shown to users (1..6), repeats for illegal

  v_total_runs := l_runs_bat + l_runs_extra;

  INSERT INTO public.ls_balls (
    innings_id, over_number, ball_number, sequence, batter_id, non_striker_id, bowler_id,
    runs_bat, runs_extra, extra_type, is_wicket, wicket_type, wicket_player_id, fielder_id, is_legal
  )
  VALUES (
    v_innings.id, v_over, v_ball, v_seq, v_state.striker_id, v_state.non_striker_id, v_state.current_bowler_id,
    l_runs_bat, l_runs_extra, nullif(p_extra_type, ''), l_is_wicket, p_wicket_type, p_wicket_player_id, p_fielder_id, v_is_legal
  )
  RETURNING id INTO v_ball_id;

  PERFORM public._ensure_batting_row(v_innings.id, v_state.striker_id);
  PERFORM public._ensure_batting_row(v_innings.id, v_state.non_striker_id);
  PERFORM public._ensure_bowling_row(v_innings.id, v_state.current_bowler_id);

  -- Update batting
  UPDATE public.ls_batting_stats
  SET runs = runs + l_runs_bat,
      balls_faced = balls_faced + CASE WHEN v_is_legal THEN 1 ELSE 0 END,
      fours = fours + CASE WHEN l_runs_bat = 4 THEN 1 ELSE 0 END,
      sixes = sixes + CASE WHEN l_runs_bat = 6 THEN 1 ELSE 0 END
  WHERE innings_id = v_innings.id AND player_id = v_state.striker_id;

  -- Wicket handling
  IF l_is_wicket THEN
    UPDATE public.ls_batting_stats
    SET is_out = true,
        dismissal_type = p_wicket_type,
        dismissal_bowler_id = v_state.current_bowler_id,
        dismissal_fielder_id = p_fielder_id
    WHERE innings_id = v_innings.id AND player_id = coalesce(p_wicket_player_id, v_state.striker_id);

    UPDATE public.ls_bowling_stats
    SET wickets = wickets + 1
    WHERE innings_id = v_innings.id AND player_id = v_state.current_bowler_id;

    UPDATE public.ls_innings
    SET total_wickets = total_wickets + 1
    WHERE id = v_innings.id;
  END IF;

  -- Bowling runs conceded
  UPDATE public.ls_bowling_stats
  SET runs_conceded = runs_conceded + v_total_runs,
      wides = wides + CASE WHEN p_extra_type = 'wide' THEN 1 ELSE 0 END,
      no_balls = no_balls + CASE WHEN p_extra_type = 'no_ball' THEN 1 ELSE 0 END,
      dot_balls = dot_balls + CASE WHEN v_is_legal AND v_total_runs = 0 AND NOT l_is_wicket THEN 1 ELSE 0 END
  WHERE innings_id = v_innings.id AND player_id = v_state.current_bowler_id;

  -- Innings totals
  UPDATE public.ls_innings
  SET total_runs = total_runs + v_total_runs,
      total_extras = total_extras + l_runs_extra
  WHERE id = v_innings.id;

  -- Over/ball progression
  v_last_over_balls := coalesce(v_state.balls_this_over, '[]'::jsonb)
    || jsonb_build_array(
      jsonb_build_object(
        'over_number', v_over, 'ball_number', v_ball, 'runs_bat', l_runs_bat, 'runs_extra', l_runs_extra,
        'extra_type', nullif(p_extra_type,''), 'is_wicket', l_is_wicket, 'is_legal', v_is_legal
      )
    );

  IF v_is_legal THEN
    IF v_state.current_ball = 5 THEN
      UPDATE public.ls_match_state
      SET current_over = current_over + 1, current_ball = 0, last_ball_id = v_ball_id, balls_this_over = '[]'::jsonb,
          partnership_runs = partnership_runs + v_total_runs, partnership_balls = partnership_balls + 1,
          score_runs = score_runs + v_total_runs, score_extras = score_extras + l_runs_extra,
          score_wickets = score_wickets + CASE WHEN l_is_wicket THEN 1 ELSE 0 END,
          score_overs = (current_over + 1)::numeric, last_event = CASE WHEN l_is_wicket THEN 'wicket' ELSE 'ball' END
      WHERE match_id = p_match_id;
    ELSE
      UPDATE public.ls_match_state
      SET current_ball = current_ball + 1, last_ball_id = v_ball_id, balls_this_over = v_last_over_balls,
          partnership_runs = partnership_runs + v_total_runs, partnership_balls = partnership_balls + 1,
          score_runs = score_runs + v_total_runs, score_extras = score_extras + l_runs_extra,
          score_wickets = score_wickets + CASE WHEN l_is_wicket THEN 1 ELSE 0 END,
          score_overs = (current_over + ((current_ball + 1)::numeric / 10)), last_event = CASE WHEN l_is_wicket THEN 'wicket' ELSE 'ball' END
      WHERE match_id = p_match_id;
    END IF;
  ELSE
    UPDATE public.ls_match_state
    SET last_ball_id = v_ball_id, balls_this_over = v_last_over_balls,
        partnership_runs = partnership_runs + v_total_runs, score_runs = score_runs + v_total_runs,
        score_extras = score_extras + l_runs_extra, last_event = 'extra'
    WHERE match_id = p_match_id;
  END IF;

  UPDATE public.ls_innings SET total_overs = (SELECT score_overs FROM public.ls_match_state WHERE match_id = p_match_id) WHERE id = v_innings.id;

  SELECT * INTO v_batting_row FROM public.ls_batting_stats WHERE innings_id = v_innings.id AND player_id = v_state.striker_id;
  SELECT * INTO v_bowling_row FROM public.ls_bowling_stats WHERE innings_id = v_innings.id AND player_id = v_state.current_bowler_id;

  -- Stats calculations
  IF v_state.score_overs > 0 THEN v_crr := (v_state.score_runs::numeric / v_state.score_overs)::numeric(5,2); ELSE v_crr := 0; END IF;
  v_rrr := NULL; IF v_state.target_score IS NOT NULL AND v_state.score_overs < v_max_overs THEN IF (v_max_overs - v_state.score_overs) > 0 THEN v_rrr := ((v_state.target_score - v_state.score_runs)::numeric / (v_max_overs - v_state.score_overs))::numeric(5,2); END IF; END IF;
  v_projected_score := NULL; IF v_innings.innings_number = 1 AND v_state.score_overs >= 2 THEN v_projected_score := ((v_state.score_runs::numeric / v_state.score_overs) * v_max_overs)::integer; END IF;

  v_stats := jsonb_build_object('crr', v_crr, 'rrr', v_rrr, 'projected_score', v_projected_score, 'partnership_runs', v_state.partnership_runs, 'partnership_balls', v_state.partnership_balls);

  UPDATE public.ls_match_state
  SET striker_snapshot = to_jsonb(v_batting_row),
      bowler_snapshot = (to_jsonb(v_bowling_row) || jsonb_build_object('economy', CASE WHEN v_bowling_row.overs > 0 THEN (v_bowling_row.runs_conceded::numeric / v_bowling_row.overs)::numeric(5,2) ELSE 0 END)),
      stats = v_stats
  WHERE match_id = p_match_id;
END;
$func$;
