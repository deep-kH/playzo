-- Football Engine V2: Complete phase management, event timeline logging, and status sync
-- Replaces the existing rpc_process_football with full lifecycle handling

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
  v_phase TEXT;
  v_is_paused BOOLEAN;
  
  -- Stats
  v_team_stats JSONB;
  v_goals INT;
  v_corners INT;
  v_fouls INT;
  v_yellows INT;
  v_reds INT;
  v_offsides INT;
  v_shots_on INT;
  v_shots_off INT;
  v_goal_kicks INT;
  v_throw_ins INT;
  v_free_kicks INT;
  
  -- Clock
  v_clock_running BOOLEAN;
  v_last_start_time TEXT;
  v_elapsed_seconds INT;
  
  -- Event
  v_event JSONB;
  v_events JSONB;
  v_event_id TEXT;
  v_penalties JSONB;
  v_penalty_order INT;
BEGIN
  -- 1. Lock and load current state
  SELECT state, is_paused INTO v_state, v_is_paused
  FROM public.ls_match_state
  WHERE match_id = p_match_id
  FOR UPDATE;

  -- 2. Initialize state if NULL
  IF v_state IS NULL OR v_state = 'null'::jsonb THEN
    v_state := jsonb_build_object(
      'phase', 'not_started',
      'status', 'scheduled',
      'clock_running', false,
      'elapsed_seconds', 0,
      'last_clock_start_time', null,
      'added_extra_time_minutes', 0,
      'team_a_stats', jsonb_build_object(
        'goals', 0, 'corners', 0, 'fouls', 0, 'yellow_cards', 0, 'red_cards', 0,
        'offsides', 0, 'shots_on_target', 0, 'shots_off_target', 0,
        'goal_kicks', 0, 'throw_ins', 0, 'free_kicks', 0
      ),
      'team_b_stats', jsonb_build_object(
        'goals', 0, 'corners', 0, 'fouls', 0, 'yellow_cards', 0, 'red_cards', 0,
        'offsides', 0, 'shots_on_target', 0, 'shots_off_target', 0,
        'goal_kicks', 0, 'throw_ins', 0, 'free_kicks', 0
      ),
      'events', '[]'::jsonb,
      'penalties', '[]'::jsonb
    );
  END IF;

  -- Extract common fields
  v_team := p_payload->>'team';
  v_phase := v_state->>'phase';
  v_clock_running := COALESCE((v_state->>'clock_running')::boolean, false);
  v_last_start_time := v_state->>'last_clock_start_time';
  v_elapsed_seconds := COALESCE((v_state->>'elapsed_seconds')::int, 0);
  v_events := COALESCE(v_state->'events', '[]'::jsonb);
  v_penalties := COALESCE(v_state->'penalties', '[]'::jsonb);

  ---------------------------------------------------------------------------
  -- HELPER: Freeze clock (reuse for multiple event types)
  ---------------------------------------------------------------------------
  -- Freeze clock inline when needed
  
  ---------------------------------------------------------------------------
  -- 3. Phase Transitions & Clock Management
  ---------------------------------------------------------------------------
  
  IF p_type = 'match_start' THEN
    -- Not Started → First Half
    v_state := jsonb_set(v_state, '{phase}', '"first_half"'::jsonb);
    v_state := jsonb_set(v_state, '{status}', '"live"'::jsonb);
    v_state := jsonb_set(v_state, '{clock_running}', 'true'::jsonb);
    v_state := jsonb_set(v_state, '{last_clock_start_time}', to_jsonb(now()::text));
    v_state := jsonb_set(v_state, '{elapsed_seconds}', '0'::jsonb);
    -- Sync ls_matches status
    UPDATE public.ls_matches SET status = 'live' WHERE id = p_match_id;

  ELSIF p_type = 'match_pause' THEN
    -- Pause: freeze clock
    IF v_clock_running THEN
      v_elapsed_seconds := v_elapsed_seconds + EXTRACT(EPOCH FROM (now() - (v_last_start_time)::timestamp))::int;
      v_state := jsonb_set(v_state, '{clock_running}', 'false'::jsonb);
      v_state := jsonb_set(v_state, '{elapsed_seconds}', to_jsonb(v_elapsed_seconds));
      v_state := jsonb_set(v_state, '{last_clock_start_time}', 'null'::jsonb);
    END IF;

  ELSIF p_type = 'match_resume' THEN
    -- Resume: restart clock
    IF NOT v_clock_running THEN
      v_state := jsonb_set(v_state, '{clock_running}', 'true'::jsonb);
      v_state := jsonb_set(v_state, '{last_clock_start_time}', to_jsonb(now()::text));
    END IF;

  ELSIF p_type = 'half_time' THEN
    -- End 1st Half: freeze clock → half_time phase
    IF v_clock_running THEN
      v_elapsed_seconds := v_elapsed_seconds + EXTRACT(EPOCH FROM (now() - (v_last_start_time)::timestamp))::int;
      v_state := jsonb_set(v_state, '{clock_running}', 'false'::jsonb);
      v_state := jsonb_set(v_state, '{elapsed_seconds}', to_jsonb(v_elapsed_seconds));
      v_state := jsonb_set(v_state, '{last_clock_start_time}', 'null'::jsonb);
    END IF;
    v_state := jsonb_set(v_state, '{phase}', '"half_time"'::jsonb);
    v_state := jsonb_set(v_state, '{added_extra_time_minutes}', '0'::jsonb);

  ELSIF p_type = 'second_half_start' THEN
    -- Half Time → Second Half: restart clock
    v_state := jsonb_set(v_state, '{phase}', '"second_half"'::jsonb);
    v_state := jsonb_set(v_state, '{clock_running}', 'true'::jsonb);
    v_state := jsonb_set(v_state, '{last_clock_start_time}', to_jsonb(now()::text));
    v_state := jsonb_set(v_state, '{added_extra_time_minutes}', '0'::jsonb);

  ELSIF p_type = 'full_time' THEN
    -- End 2nd Half (or ET 2nd): freeze clock → full_time
    -- Does NOT end the match — admin can choose ET, penalties, or end match
    IF v_clock_running THEN
      v_elapsed_seconds := v_elapsed_seconds + EXTRACT(EPOCH FROM (now() - (v_last_start_time)::timestamp))::int;
      v_state := jsonb_set(v_state, '{clock_running}', 'false'::jsonb);
      v_state := jsonb_set(v_state, '{elapsed_seconds}', to_jsonb(v_elapsed_seconds));
      v_state := jsonb_set(v_state, '{last_clock_start_time}', 'null'::jsonb);
    END IF;
    v_state := jsonb_set(v_state, '{phase}', '"full_time"'::jsonb);
    v_state := jsonb_set(v_state, '{added_extra_time_minutes}', '0'::jsonb);

  ELSIF p_type = 'extra_time_start' THEN
    -- Full Time → Extra Time 1st Half
    v_state := jsonb_set(v_state, '{phase}', '"extra_time_first"'::jsonb);
    v_state := jsonb_set(v_state, '{clock_running}', 'true'::jsonb);
    v_state := jsonb_set(v_state, '{last_clock_start_time}', to_jsonb(now()::text));
    v_state := jsonb_set(v_state, '{added_extra_time_minutes}', '0'::jsonb);

  ELSIF p_type = 'extra_time_half' THEN
    -- ET 1st Half → ET Half Time
    IF v_clock_running THEN
      v_elapsed_seconds := v_elapsed_seconds + EXTRACT(EPOCH FROM (now() - (v_last_start_time)::timestamp))::int;
      v_state := jsonb_set(v_state, '{clock_running}', 'false'::jsonb);
      v_state := jsonb_set(v_state, '{elapsed_seconds}', to_jsonb(v_elapsed_seconds));
      v_state := jsonb_set(v_state, '{last_clock_start_time}', 'null'::jsonb);
    END IF;
    v_state := jsonb_set(v_state, '{phase}', '"extra_time_half"'::jsonb);

  ELSIF p_type = 'extra_time_second_start' THEN
    -- ET Half Time → ET 2nd Half
    v_state := jsonb_set(v_state, '{phase}', '"extra_time_second"'::jsonb);
    v_state := jsonb_set(v_state, '{clock_running}', 'true'::jsonb);
    v_state := jsonb_set(v_state, '{last_clock_start_time}', to_jsonb(now()::text));

  ELSIF p_type = 'penalty_shootout_start' THEN
    -- Full Time → Penalty Shootout (only for drawn matches)
    v_state := jsonb_set(v_state, '{phase}', '"penalty_shootout"'::jsonb);
    v_state := jsonb_set(v_state, '{clock_running}', 'false'::jsonb);

  ELSIF p_type = 'match_end' THEN
    -- Final: match over
    IF v_clock_running THEN
      v_elapsed_seconds := v_elapsed_seconds + EXTRACT(EPOCH FROM (now() - (v_last_start_time)::timestamp))::int;
      v_state := jsonb_set(v_state, '{clock_running}', 'false'::jsonb);
      v_state := jsonb_set(v_state, '{elapsed_seconds}', to_jsonb(v_elapsed_seconds));
      v_state := jsonb_set(v_state, '{last_clock_start_time}', 'null'::jsonb);
    END IF;
    v_state := jsonb_set(v_state, '{phase}', '"ended"'::jsonb);
    v_state := jsonb_set(v_state, '{status}', '"completed"'::jsonb);
    -- Sync ls_matches status
    UPDATE public.ls_matches SET status = 'completed' WHERE id = p_match_id;

  ELSIF p_type = 'extra_time_added' THEN
    v_state := jsonb_set(
      v_state,
      '{added_extra_time_minutes}',
      to_jsonb(COALESCE((p_payload->>'extra_minutes')::int, 0))
    );

  ---------------------------------------------------------------------------
  -- 4. Penalty Events
  ---------------------------------------------------------------------------
  ELSIF p_type IN ('penalty_goal', 'penalty_miss') THEN
    v_penalty_order := jsonb_array_length(v_penalties) + 1;
    v_penalties := v_penalties || jsonb_build_object(
      'team', v_team,
      'player_name', COALESCE(p_payload->>'player_name', ''),
      'scored', (p_type = 'penalty_goal'),
      'order', v_penalty_order
    );
    v_state := jsonb_set(v_state, '{penalties}', v_penalties);
    
    -- Also update goals for penalty_goal
    IF p_type = 'penalty_goal' AND v_team IS NOT NULL THEN
      IF v_team = 'team_a' THEN
        v_team_stats := v_state->'team_a_stats';
      ELSE
        v_team_stats := v_state->'team_b_stats';
      END IF;
      -- Don't count penalty shootout goals in regular stat goals
      -- They are tracked separately in the penalties array
    END IF;

  ---------------------------------------------------------------------------
  -- 5. In-game events that update team stats
  ---------------------------------------------------------------------------
  ELSIF v_team IS NOT NULL AND v_team IN ('team_a', 'team_b') THEN
    
    IF v_team = 'team_a' THEN
      v_team_stats := v_state->'team_a_stats';
    ELSE
      v_team_stats := v_state->'team_b_stats';
    END IF;
    
    v_goals := COALESCE((v_team_stats->>'goals')::int, 0);
    v_corners := COALESCE((v_team_stats->>'corners')::int, 0);
    v_fouls := COALESCE((v_team_stats->>'fouls')::int, 0);
    v_yellows := COALESCE((v_team_stats->>'yellow_cards')::int, 0);
    v_reds := COALESCE((v_team_stats->>'red_cards')::int, 0);
    v_offsides := COALESCE((v_team_stats->>'offsides')::int, 0);
    v_shots_on := COALESCE((v_team_stats->>'shots_on_target')::int, 0);
    v_shots_off := COALESCE((v_team_stats->>'shots_off_target')::int, 0);
    v_goal_kicks := COALESCE((v_team_stats->>'goal_kicks')::int, 0);
    v_throw_ins := COALESCE((v_team_stats->>'throw_ins')::int, 0);
    v_free_kicks := COALESCE((v_team_stats->>'free_kicks')::int, 0);

    IF p_type IN ('goal', 'own_goal') THEN
      v_goals := v_goals + 1;
      IF p_type = 'goal' THEN
        v_shots_on := v_shots_on + 1;
      END IF;
    ELSIF p_type = 'corner' THEN
      v_corners := v_corners + 1;
    ELSIF p_type = 'foul' THEN
      v_fouls := v_fouls + 1;
    ELSIF p_type = 'yellow_card' THEN
      v_yellows := v_yellows + 1;
      v_fouls := v_fouls + 1;
    ELSIF p_type = 'red_card' THEN
      v_reds := v_reds + 1;
    ELSIF p_type = 'offside' THEN
      v_offsides := v_offsides + 1;
    ELSIF p_type = 'shot_on_target' THEN
      v_shots_on := v_shots_on + 1;
    ELSIF p_type = 'shot_off_target' THEN
      v_shots_off := v_shots_off + 1;
    ELSIF p_type = 'goal_kick' THEN
      v_goal_kicks := v_goal_kicks + 1;
    ELSIF p_type = 'throw_in' THEN
      v_throw_ins := v_throw_ins + 1;
    ELSIF p_type = 'free_kick' THEN
      v_free_kicks := v_free_kicks + 1;
    END IF;

    v_team_stats := jsonb_build_object(
      'goals', v_goals,
      'corners', v_corners,
      'fouls', v_fouls,
      'yellow_cards', v_yellows,
      'red_cards', v_reds,
      'offsides', v_offsides,
      'shots_on_target', v_shots_on,
      'shots_off_target', v_shots_off,
      'goal_kicks', v_goal_kicks,
      'throw_ins', v_throw_ins,
      'free_kicks', v_free_kicks
    );

    IF v_team = 'team_a' THEN
      v_state := jsonb_set(v_state, '{team_a_stats}', v_team_stats);
    ELSE
      v_state := jsonb_set(v_state, '{team_b_stats}', v_team_stats);
    END IF;

  END IF;

  ---------------------------------------------------------------------------
  -- 6. Build event entry for timeline (for in-game events only)
  ---------------------------------------------------------------------------
  IF p_type NOT IN ('match_start', 'match_pause', 'match_resume', 'extra_time_added') THEN
    v_event_id := gen_random_uuid()::text;
    v_event := jsonb_build_object(
      'id', v_event_id,
      'type', p_type,
      'team', COALESCE(v_team, ''),
      'player_name', COALESCE(p_payload->>'player_name', ''),
      'assist_name', COALESCE(p_payload->>'assist_player_name', ''),
      'match_time_seconds', v_elapsed_seconds,
      'stoppage_time_seconds', COALESCE((v_state->>'added_extra_time_minutes')::int, 0) * 60,
      'details', COALESCE(p_payload->>'notes', 
        CASE 
          WHEN p_type = 'substitution' THEN COALESCE(p_payload->>'sub_out_name', '') || ' → ' || COALESCE(p_payload->>'sub_in_name', '')
          WHEN p_type IN ('yellow_card', 'red_card', 'foul') THEN COALESCE(p_payload->>'foul_outcome', '')
          ELSE ''
        END
      ),
      'created_at', now()::text
    );
    v_events := v_events || v_event;
    v_state := jsonb_set(v_state, '{events}', v_events);
  END IF;

  ---------------------------------------------------------------------------
  -- 7. Set last_event_text for UI overlays
  ---------------------------------------------------------------------------
  v_state := jsonb_set(v_state, '{last_event_text}', to_jsonb(p_type));

  ---------------------------------------------------------------------------
  -- 8. Insert log and update snapshot
  ---------------------------------------------------------------------------
  INSERT INTO public.ls_events(match_id, sport, type, payload)
  VALUES (p_match_id, 'football', p_type, p_payload);

  UPDATE public.ls_match_state
  SET state = v_state,
      updated_at = now()
  WHERE match_id = p_match_id;

END;
$$;
