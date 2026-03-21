-- Football Engine V4: Player match_stats + micro-actions
-- Adds match_stats JSONB column to players table
-- Updates rpc_process_football to increment player stats and handle micro-actions

-- 1. Add match_stats column
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS match_stats JSONB DEFAULT '[]';

-- 2. Recreate football RPC with player stats tracking + micro-actions
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
  v_saves INT;
  
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

  -- Player stats
  v_player_id TEXT;
  v_player_stats JSONB;
  v_cur_player_stats JSONB;
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
        'goal_kicks', 0, 'throw_ins', 0, 'free_kicks', 0, 'saves', 0
      ),
      'team_b_stats', jsonb_build_object(
        'goals', 0, 'corners', 0, 'fouls', 0, 'yellow_cards', 0, 'red_cards', 0,
        'offsides', 0, 'shots_on_target', 0, 'shots_off_target', 0,
        'goal_kicks', 0, 'throw_ins', 0, 'free_kicks', 0, 'saves', 0
      ),
      'player_stats', '{}'::jsonb,
      'events', '[]'::jsonb,
      'penalties', '[]'::jsonb
    );
  END IF;

  -- Ensure player_stats exists
  IF v_state->'player_stats' IS NULL THEN
    v_state := jsonb_set(v_state, '{player_stats}', '{}'::jsonb);
  END IF;

  -- Extract common fields
  v_team := p_payload->>'team';
  v_player_id := p_payload->>'player_id';
  v_phase := v_state->>'phase';
  v_clock_running := COALESCE((v_state->>'clock_running')::boolean, false);
  v_last_start_time := v_state->>'last_clock_start_time';
  v_elapsed_seconds := COALESCE((v_state->>'elapsed_seconds')::int, 0);
  v_events := COALESCE(v_state->'events', '[]'::jsonb);
  v_penalties := COALESCE(v_state->'penalties', '[]'::jsonb);
  v_player_stats := COALESCE(v_state->'player_stats', '{}'::jsonb);
  
  ---------------------------------------------------------------------------
  -- 3. Phase Transitions & Clock Management
  ---------------------------------------------------------------------------
  
  IF p_type = 'match_start' THEN
    v_state := jsonb_set(v_state, '{phase}', '"first_half"'::jsonb);
    v_state := jsonb_set(v_state, '{status}', '"live"'::jsonb);
    v_state := jsonb_set(v_state, '{clock_running}', 'true'::jsonb);
    v_state := jsonb_set(v_state, '{last_clock_start_time}', to_jsonb(now()::text));
    v_state := jsonb_set(v_state, '{elapsed_seconds}', '0'::jsonb);
    UPDATE public.ls_matches SET status = 'live' WHERE id = p_match_id;

  ELSIF p_type = 'match_pause' THEN
    IF v_clock_running THEN
      v_elapsed_seconds := v_elapsed_seconds + EXTRACT(EPOCH FROM (now() - (v_last_start_time)::timestamp))::int;
      v_state := jsonb_set(v_state, '{clock_running}', 'false'::jsonb);
      v_state := jsonb_set(v_state, '{elapsed_seconds}', to_jsonb(v_elapsed_seconds));
      v_state := jsonb_set(v_state, '{last_clock_start_time}', 'null'::jsonb);
    END IF;

  ELSIF p_type = 'match_resume' THEN
    IF NOT v_clock_running THEN
      v_state := jsonb_set(v_state, '{clock_running}', 'true'::jsonb);
      v_state := jsonb_set(v_state, '{last_clock_start_time}', to_jsonb(now()::text));
    END IF;

  ELSIF p_type = 'half_time' THEN
    IF v_clock_running THEN
      v_elapsed_seconds := v_elapsed_seconds + EXTRACT(EPOCH FROM (now() - (v_last_start_time)::timestamp))::int;
      v_state := jsonb_set(v_state, '{clock_running}', 'false'::jsonb);
      v_state := jsonb_set(v_state, '{elapsed_seconds}', to_jsonb(v_elapsed_seconds));
      v_state := jsonb_set(v_state, '{last_clock_start_time}', 'null'::jsonb);
    END IF;
    v_state := jsonb_set(v_state, '{phase}', '"half_time"'::jsonb);
    v_state := jsonb_set(v_state, '{added_extra_time_minutes}', '0'::jsonb);

  ELSIF p_type = 'second_half_start' THEN
    v_state := jsonb_set(v_state, '{phase}', '"second_half"'::jsonb);
    v_state := jsonb_set(v_state, '{clock_running}', 'true'::jsonb);
    v_state := jsonb_set(v_state, '{last_clock_start_time}', to_jsonb(now()::text));
    v_state := jsonb_set(v_state, '{elapsed_seconds}', '0'::jsonb);
    v_state := jsonb_set(v_state, '{added_extra_time_minutes}', '0'::jsonb);

  ELSIF p_type = 'full_time' THEN
    IF v_clock_running THEN
      v_elapsed_seconds := v_elapsed_seconds + EXTRACT(EPOCH FROM (now() - (v_last_start_time)::timestamp))::int;
      v_state := jsonb_set(v_state, '{clock_running}', 'false'::jsonb);
      v_state := jsonb_set(v_state, '{elapsed_seconds}', to_jsonb(v_elapsed_seconds));
      v_state := jsonb_set(v_state, '{last_clock_start_time}', 'null'::jsonb);
    END IF;
    v_state := jsonb_set(v_state, '{phase}', '"full_time"'::jsonb);
    v_state := jsonb_set(v_state, '{added_extra_time_minutes}', '0'::jsonb);

  ELSIF p_type = 'extra_time_start' THEN
    v_state := jsonb_set(v_state, '{phase}', '"extra_time_first"'::jsonb);
    v_state := jsonb_set(v_state, '{clock_running}', 'true'::jsonb);
    v_state := jsonb_set(v_state, '{last_clock_start_time}', to_jsonb(now()::text));
    v_state := jsonb_set(v_state, '{added_extra_time_minutes}', '0'::jsonb);

  ELSIF p_type = 'extra_time_half' THEN
    IF v_clock_running THEN
      v_elapsed_seconds := v_elapsed_seconds + EXTRACT(EPOCH FROM (now() - (v_last_start_time)::timestamp))::int;
      v_state := jsonb_set(v_state, '{clock_running}', 'false'::jsonb);
      v_state := jsonb_set(v_state, '{elapsed_seconds}', to_jsonb(v_elapsed_seconds));
      v_state := jsonb_set(v_state, '{last_clock_start_time}', 'null'::jsonb);
    END IF;
    v_state := jsonb_set(v_state, '{phase}', '"extra_time_half"'::jsonb);

  ELSIF p_type = 'extra_time_second_start' THEN
    v_state := jsonb_set(v_state, '{phase}', '"extra_time_second"'::jsonb);
    v_state := jsonb_set(v_state, '{clock_running}', 'true'::jsonb);
    v_state := jsonb_set(v_state, '{last_clock_start_time}', to_jsonb(now()::text));

  ELSIF p_type = 'penalty_shootout_start' THEN
    v_state := jsonb_set(v_state, '{phase}', '"penalty_shootout"'::jsonb);
    v_state := jsonb_set(v_state, '{clock_running}', 'false'::jsonb);

  ELSIF p_type = 'match_end' THEN
    IF v_clock_running THEN
      v_elapsed_seconds := v_elapsed_seconds + EXTRACT(EPOCH FROM (now() - (v_last_start_time)::timestamp))::int;
      v_state := jsonb_set(v_state, '{clock_running}', 'false'::jsonb);
      v_state := jsonb_set(v_state, '{elapsed_seconds}', to_jsonb(v_elapsed_seconds));
      v_state := jsonb_set(v_state, '{last_clock_start_time}', 'null'::jsonb);
    END IF;
    v_state := jsonb_set(v_state, '{phase}', '"ended"'::jsonb);
    v_state := jsonb_set(v_state, '{status}', '"completed"'::jsonb);
    UPDATE public.ls_matches SET status = 'completed' WHERE id = p_match_id;

  ELSIF p_type = 'extra_time_added' THEN
    v_state := jsonb_set(
      v_state,
      '{added_extra_time_minutes}',
      to_jsonb(COALESCE((v_state->>'added_extra_time_minutes')::int, 0) + COALESCE((p_payload->>'extra_minutes')::int, 1))
    );

  ---------------------------------------------------------------------------
  -- 4. Penalty Events
  ---------------------------------------------------------------------------
  ELSIF p_type IN ('penalty_goal', 'penalty_miss') THEN
    v_penalty_order := jsonb_array_length(v_penalties) + 1;
    v_penalties := v_penalties || jsonb_build_object(
      'team', v_team,
      'player_id', p_payload->>'player_id',
      'player_name', COALESCE(p_payload->>'player_name', ''),
      'photo_url', p_payload->>'photo_url',
      'scored', (p_type = 'penalty_goal'),
      'order', v_penalty_order
    );
    v_state := jsonb_set(v_state, '{penalties}', v_penalties);

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
    v_saves := COALESCE((v_team_stats->>'saves')::int, 0);

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
    ELSIF p_type = 'save' THEN
      v_saves := v_saves + 1;
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
      'free_kicks', v_free_kicks,
      'saves', v_saves
    );

    IF v_team = 'team_a' THEN
      v_state := jsonb_set(v_state, '{team_a_stats}', v_team_stats);
    ELSE
      v_state := jsonb_set(v_state, '{team_b_stats}', v_team_stats);
    END IF;

  END IF;

  ---------------------------------------------------------------------------
  -- 5b. Update per-player stats in state (for player-related events)
  ---------------------------------------------------------------------------
  IF v_player_id IS NOT NULL AND p_type NOT IN (
    'match_start', 'match_pause', 'match_resume', 'extra_time_added',
    'half_time', 'second_half_start', 'full_time', 'match_end',
    'extra_time_start', 'extra_time_half', 'extra_time_second_start',
    'penalty_shootout_start'
  ) THEN
    -- Get or init player stats
    v_cur_player_stats := COALESCE(v_player_stats->v_player_id, jsonb_build_object(
      'goals', 0, 'assists', 0, 'shots_on', 0, 'shots_off', 0, 'saves', 0,
      'fouls_committed', 0, 'fouls_drawn', 0, 'yellow_cards', 0, 'red_cards', 0,
      'tackles', 0, 'interceptions', 0, 'clearances', 0, 'blocks', 0,
      'dribbles', 0, 'possession_won', 0, 'minutes_played', 0
    ));

    -- Increment based on event type
    IF p_type = 'goal' THEN
      v_cur_player_stats := jsonb_set(v_cur_player_stats, '{goals}', to_jsonb(COALESCE((v_cur_player_stats->>'goals')::int, 0) + 1));
    ELSIF p_type = 'shot_on_target' THEN
      v_cur_player_stats := jsonb_set(v_cur_player_stats, '{shots_on}', to_jsonb(COALESCE((v_cur_player_stats->>'shots_on')::int, 0) + 1));
    ELSIF p_type = 'shot_off_target' THEN
      v_cur_player_stats := jsonb_set(v_cur_player_stats, '{shots_off}', to_jsonb(COALESCE((v_cur_player_stats->>'shots_off')::int, 0) + 1));
    ELSIF p_type = 'save' THEN
      v_cur_player_stats := jsonb_set(v_cur_player_stats, '{saves}', to_jsonb(COALESCE((v_cur_player_stats->>'saves')::int, 0) + 1));
    ELSIF p_type = 'foul' THEN
      v_cur_player_stats := jsonb_set(v_cur_player_stats, '{fouls_committed}', to_jsonb(COALESCE((v_cur_player_stats->>'fouls_committed')::int, 0) + 1));
    ELSIF p_type = 'yellow_card' THEN
      v_cur_player_stats := jsonb_set(v_cur_player_stats, '{yellow_cards}', to_jsonb(COALESCE((v_cur_player_stats->>'yellow_cards')::int, 0) + 1));
    ELSIF p_type = 'red_card' THEN
      v_cur_player_stats := jsonb_set(v_cur_player_stats, '{red_cards}', to_jsonb(COALESCE((v_cur_player_stats->>'red_cards')::int, 0) + 1));
    ELSIF p_type = 'tackle' THEN
      v_cur_player_stats := jsonb_set(v_cur_player_stats, '{tackles}', to_jsonb(COALESCE((v_cur_player_stats->>'tackles')::int, 0) + 1));
    ELSIF p_type = 'interception' THEN
      v_cur_player_stats := jsonb_set(v_cur_player_stats, '{interceptions}', to_jsonb(COALESCE((v_cur_player_stats->>'interceptions')::int, 0) + 1));
    ELSIF p_type = 'clearance' THEN
      v_cur_player_stats := jsonb_set(v_cur_player_stats, '{clearances}', to_jsonb(COALESCE((v_cur_player_stats->>'clearances')::int, 0) + 1));
    ELSIF p_type = 'block' THEN
      v_cur_player_stats := jsonb_set(v_cur_player_stats, '{blocks}', to_jsonb(COALESCE((v_cur_player_stats->>'blocks')::int, 0) + 1));
    ELSIF p_type = 'dribble' THEN
      v_cur_player_stats := jsonb_set(v_cur_player_stats, '{dribbles}', to_jsonb(COALESCE((v_cur_player_stats->>'dribbles')::int, 0) + 1));
    ELSIF p_type = 'possession_won' THEN
      v_cur_player_stats := jsonb_set(v_cur_player_stats, '{possession_won}', to_jsonb(COALESCE((v_cur_player_stats->>'possession_won')::int, 0) + 1));
    END IF;

    v_player_stats := jsonb_set(v_player_stats, ARRAY[v_player_id], v_cur_player_stats);
    v_state := jsonb_set(v_state, '{player_stats}', v_player_stats);

    -- Also handle assist player
    IF p_type = 'goal' AND (p_payload->>'assist_player_id') IS NOT NULL THEN
      DECLARE
        v_assist_id TEXT := p_payload->>'assist_player_id';
        v_assist_stats JSONB;
      BEGIN
        v_assist_stats := COALESCE(v_player_stats->v_assist_id, jsonb_build_object(
          'goals', 0, 'assists', 0, 'shots_on', 0, 'shots_off', 0, 'saves', 0,
          'fouls_committed', 0, 'fouls_drawn', 0, 'yellow_cards', 0, 'red_cards', 0,
          'tackles', 0, 'interceptions', 0, 'clearances', 0, 'blocks', 0,
          'dribbles', 0, 'possession_won', 0, 'minutes_played', 0
        ));
        v_assist_stats := jsonb_set(v_assist_stats, '{assists}', to_jsonb(COALESCE((v_assist_stats->>'assists')::int, 0) + 1));
        v_player_stats := jsonb_set(v_player_stats, ARRAY[v_assist_id], v_assist_stats);
        v_state := jsonb_set(v_state, '{player_stats}', v_player_stats);
      END;
    END IF;

    -- Handle fouled player (fouls_drawn)
    IF p_type = 'foul' AND (p_payload->>'fouled_player_id') IS NOT NULL THEN
      DECLARE
        v_fouled_id TEXT := p_payload->>'fouled_player_id';
        v_fouled_stats JSONB;
      BEGIN
        v_fouled_stats := COALESCE(v_player_stats->v_fouled_id, jsonb_build_object(
          'goals', 0, 'assists', 0, 'shots_on', 0, 'shots_off', 0, 'saves', 0,
          'fouls_committed', 0, 'fouls_drawn', 0, 'yellow_cards', 0, 'red_cards', 0,
          'tackles', 0, 'interceptions', 0, 'clearances', 0, 'blocks', 0,
          'dribbles', 0, 'possession_won', 0, 'minutes_played', 0
        ));
        v_fouled_stats := jsonb_set(v_fouled_stats, '{fouls_drawn}', to_jsonb(COALESCE((v_fouled_stats->>'fouls_drawn')::int, 0) + 1));
        v_player_stats := jsonb_set(v_player_stats, ARRAY[v_fouled_id], v_fouled_stats);
        v_state := jsonb_set(v_state, '{player_stats}', v_player_stats);
      END;
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
      'player_id', p_payload->>'player_id',
      'player_name', COALESCE(p_payload->>'player_name', ''),
      'photo_url', p_payload->>'photo_url',
      'assist_player_id', p_payload->>'assist_player_id',
      'assist_name', COALESCE(p_payload->>'assist_player_name', ''),
      'fouled_player_id', p_payload->>'fouled_player_id',
      'fouled_player_name', COALESCE(p_payload->>'fouled_player_name', ''),
      'match_time_seconds', v_elapsed_seconds,
      'stoppage_time_seconds', COALESCE((v_state->>'added_extra_time_minutes')::int, 0) * 60,
      'details', COALESCE(p_payload->>'notes', 
        CASE 
          WHEN p_type = 'substitution' THEN COALESCE(p_payload->>'sub_out_name', '') || ' → ' || COALESCE(p_payload->>'sub_in_name', '')
          WHEN p_type IN ('yellow_card', 'red_card', 'foul') THEN COALESCE(p_payload->>'foul_outcome', '')
          WHEN p_type = 'shot_on_target' THEN COALESCE(p_payload->>'shot_outcome', '')
          WHEN p_type = 'shot_off_target' THEN COALESCE(p_payload->>'shot_outcome', '')
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
