-- Migration for Phase 4 (Football Engine)
-- Replaces the stub `rpc_process_football` with the full implementation

CREATE OR REPLACE FUNCTION public.rpc_process_football(
  p_match_id UUID,
  p_type TEXT,
  p_payload JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state JSONB;
  v_team TEXT;
  v_period TEXT;
  v_is_paused BOOLEAN;
  
  -- Stats placeholders
  v_team_stats JSONB;
  v_goals INT;
  v_corners INT;
  v_fouls INT;
  v_yellows INT;
  v_reds INT;
  v_offsides INT;
  v_shots_on INT;
  v_shots_off INT;
  
  -- Clock placeholders
  v_clock_running BOOLEAN;
  v_last_start_time TEXT;
  v_elapsed_seconds INT;
BEGIN
  -- 1. Lock and load current State
  SELECT state, is_paused INTO v_state, v_is_paused
  FROM public.ls_match_state
  WHERE match_id = p_match_id
  FOR UPDATE;

  -- 2. Initialize state if NULL
  IF v_state IS NULL OR v_state = 'null'::jsonb THEN
    v_state := '{
      "period": "first_half",
      "status": "scheduled",
      "clock_running": false,
      "elapsed_seconds": 0,
      "last_clock_start_time": null,
      "added_extra_time_minutes": 0,
      "team_a_stats": {
        "goals": 0, "corners": 0, "fouls": 0, "yellow_cards": 0, "red_cards": 0, 
        "offsides": 0, "shots_on_target": 0, "shots_off_target": 0
      },
      "team_b_stats": {
        "goals": 0, "corners": 0, "fouls": 0, "yellow_cards": 0, "red_cards": 0, 
        "offsides": 0, "shots_on_target": 0, "shots_off_target": 0
      }
    }'::jsonb;
  END IF;

  -- Extract common properties from payload
  v_team := p_payload->>'team'; -- 'team_a' or 'team_b'
  
  -- Extract Clocks
  v_clock_running := (v_state->>'clock_running')::boolean;
  v_last_start_time := v_state->>'last_clock_start_time';
  v_elapsed_seconds := COALESCE((v_state->>'elapsed_seconds')::int, 0);

  ---------------------------------------------------------------------------
  -- 3. Match Clock / Period Core Logic
  ---------------------------------------------------------------------------
  IF p_type = 'match_start' OR p_type = 'match_resume' THEN
    IF v_clock_running = false THEN
      v_state := jsonb_set(v_state, '{clock_running}', 'true'::jsonb);
      v_state := jsonb_set(v_state, '{last_clock_start_time}', to_jsonb(now()::text));
      
      IF p_type = 'match_start' AND (v_state->>'status') = 'scheduled' THEN
         v_state := jsonb_set(v_state, '{status}', '"live"'::jsonb);
      END IF;
    END IF;

  ELSIF p_type = 'match_pause' OR p_type = 'half_time' OR p_type = 'full_time' THEN
    IF v_clock_running = true THEN
      -- Calculate drift
      v_elapsed_seconds := v_elapsed_seconds + EXTRACT(EPOCH FROM (now() - (v_last_start_time)::timestamp))::int;
      
      -- Update state with new settled elapsed seconds
      v_state := jsonb_set(v_state, '{clock_running}', 'false'::jsonb);
      v_state := jsonb_set(v_state, '{elapsed_seconds}', to_jsonb(v_elapsed_seconds));
      v_state := jsonb_set(v_state, '{last_clock_start_time}', 'null'::jsonb);
    END IF;
    
    -- Handle Status changes based on Period events
    IF p_type = 'half_time' THEN
       v_state := jsonb_set(v_state, '{period}', '"half_time"'::jsonb);
    ELSIF p_type = 'full_time' THEN
       v_state := jsonb_set(v_state, '{period}', '"full_time"'::jsonb);
       v_state := jsonb_set(v_state, '{status}', '"completed"'::jsonb);
    END IF;

  ELSIF p_type = 'extra_time_added' THEN
     v_state := jsonb_set(
       v_state, 
       '{added_extra_time_minutes}', 
       to_jsonb(COALESCE((p_payload->>'extra_minutes')::int, 0))
     );

  ---------------------------------------------------------------------------
  -- 4. In-game events that augment TEAM STATS
  ---------------------------------------------------------------------------
  ELSIF v_team IS NOT NULL AND v_team IN ('team_a', 'team_b') THEN
    
    -- Extract the correct team stats block
    IF v_team = 'team_a' THEN
      v_team_stats := v_state->'team_a_stats';
    ELSE
      v_team_stats := v_state->'team_b_stats';
    END IF;
    
    -- Extract specific counters
    v_goals := COALESCE((v_team_stats->>'goals')::int, 0);
    v_corners := COALESCE((v_team_stats->>'corners')::int, 0);
    v_fouls := COALESCE((v_team_stats->>'fouls')::int, 0);
    v_yellows := COALESCE((v_team_stats->>'yellow_cards')::int, 0);
    v_reds := COALESCE((v_team_stats->>'red_cards')::int, 0);
    v_offsides := COALESCE((v_team_stats->>'offsides')::int, 0);
    v_shots_on := COALESCE((v_team_stats->>'shots_on_target')::int, 0);
    v_shots_off := COALESCE((v_team_stats->>'shots_off_target')::int, 0);

    -- Apply changes
    IF p_type IN ('goal', 'penalty_goal') THEN
      v_goals := v_goals + 1;
      v_shots_on := v_shots_on + 1; -- goals implicitly count as shots on target
    ELSIF p_type = 'own_goal' THEN
      -- If team_a commits own goal, team_b gets point, but team_a gets stat penalty?
      -- For simplicity, standard system usually credits 'team' payload as the SCORING team.
      -- E.g. If payload team='team_a', team A scores, regardless of who kicked it in.
      v_goals := v_goals + 1;
    ELSIF p_type = 'corner' THEN
      v_corners := v_corners + 1;
    ELSIF p_type = 'foul' THEN
      v_fouls := v_fouls + 1;
    ELSIF p_type = 'yellow_card' THEN
      v_yellows := v_yellows + 1;
    ELSIF p_type = 'red_card' THEN
      v_reds := v_reds + 1;
    ELSIF p_type = 'offside' THEN
      v_offsides := v_offsides + 1;
    ELSIF p_type = 'shot_on_target' THEN
      v_shots_on := v_shots_on + 1;
    ELSIF p_type = 'shot_off_target' THEN
      v_shots_off := v_shots_off + 1;
    END IF;

    -- Serialize back to JSON
    v_team_stats := jsonb_build_object(
      'goals', v_goals,
      'corners', v_corners,
      'fouls', v_fouls,
      'yellow_cards', v_yellows,
      'red_cards', v_reds,
      'offsides', v_offsides,
      'shots_on_target', v_shots_on,
      'shots_off_target', v_shots_off
    );

    IF v_team = 'team_a' THEN
      v_state := jsonb_set(v_state, '{team_a_stats}', v_team_stats);
    ELSE
      v_state := jsonb_set(v_state, '{team_b_stats}', v_team_stats);
    END IF;

  END IF;

  ---------------------------------------------------------------------------
  -- 5. Set UI Last Event Helper (for overlays/tickers)
  ---------------------------------------------------------------------------
  IF p_type NOT IN ('match_start', 'match_pause', 'match_resume', 'half_time', 'full_time') THEN
     v_state := jsonb_set(v_state, '{last_event_text}', to_jsonb(p_type));
  END IF;

  ---------------------------------------------------------------------------
  -- 6. Insert Log and Update Snapshot
  ---------------------------------------------------------------------------
  INSERT INTO public.ls_events(match_id, sport, type, payload)
  VALUES (p_match_id, 'football', p_type, p_payload);

  UPDATE public.ls_match_state
  SET state = v_state,
      updated_at = now()
  WHERE match_id = p_match_id;

END;
$$;
