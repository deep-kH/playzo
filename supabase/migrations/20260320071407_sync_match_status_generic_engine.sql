-- Migration: Sync Match Status Generic Engine
-- Updates the badminton RPC to properly sync the `status` column in `ls_matches`
-- so that queries filtering by status (like the Live Dashboard) can find them.

CREATE OR REPLACE FUNCTION public.rpc_process_badminton(
  p_match_id UUID,
  p_type     TEXT,
  p_payload  JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state          JSONB;
  v_is_paused      BOOLEAN;

  -- Current game context
  v_current_game   INT;
  v_game_key       TEXT;
  v_score_a        INT;
  v_score_b        INT;
  v_server         TEXT;
  v_serving_side   TEXT;
  v_games_won_a    INT;
  v_games_won_b    INT;
  v_match_type     TEXT;
  
  -- Rally history
  v_history        JSONB;
  v_previous_state JSONB;

  -- Point winner
  v_point_winner   TEXT;
  v_new_score_a    INT;
  v_new_score_b    INT;
  v_winner_score   INT;
  v_loser_score    INT;
  v_game_won       BOOLEAN;
  v_server_score   INT;

  -- Flip positions
  v_team           TEXT;
  v_left           TEXT;
  v_right          TEXT;
BEGIN
  -- 1. Lock and load current state
  SELECT state, is_paused INTO v_state, v_is_paused
  FROM public.ls_match_state
  WHERE match_id = p_match_id
  FOR UPDATE;

  -- 2. Initialize state if NULL
  IF v_state IS NULL OR v_state = 'null'::jsonb THEN
    v_state := '{
      "match_type": "singles",
      "status": "scheduled",
      "current_game": 1,
      "scores": {
        "g1": {"team_a": 0, "team_b": 0},
        "g2": {"team_a": 0, "team_b": 0},
        "g3": {"team_a": 0, "team_b": 0}
      },
      "games_won": {"team_a": 0, "team_b": 0},
      "server": "team_a",
      "server_player_id": null,
      "serving_side": "right",
      "doubles_positions": null,
      "rally_history": []
    }'::jsonb;
  END IF;

  -- Maintain rally_history init if absent
  IF v_state->'rally_history' IS NULL THEN
    v_state := jsonb_set(v_state, '{rally_history}', '[]');
  END IF;

  -- Extract frequently used fields
  v_current_game := COALESCE((v_state->>'current_game')::int, 1);
  v_game_key     := 'g' || v_current_game;
  v_server       := COALESCE(v_state->>'server', 'team_a');
  v_serving_side := COALESCE(v_state->>'serving_side', 'right');
  v_games_won_a  := COALESCE((v_state->'games_won'->>'team_a')::int, 0);
  v_games_won_b  := COALESCE((v_state->'games_won'->>'team_b')::int, 0);
  v_match_type   := COALESCE(v_state->>'match_type', 'singles');

  v_score_a := COALESCE((v_state->'scores'->v_game_key->>'team_a')::int, 0);
  v_score_b := COALESCE((v_state->'scores'->v_game_key->>'team_b')::int, 0);

  ---------------------------------------------------------------------------
  -- 3. Event Routing
  ---------------------------------------------------------------------------

  IF p_type = 'match_start' THEN
    v_state := jsonb_set(v_state, '{status}', '"live"');
    UPDATE public.ls_matches SET status = 'live' WHERE id = p_match_id;
    
    IF p_payload->>'match_type' IS NOT NULL THEN
      v_state := jsonb_set(v_state, '{match_type}', to_jsonb(p_payload->>'match_type'));
    END IF;

    IF p_payload->>'first_server' IS NOT NULL THEN
      v_state := jsonb_set(v_state, '{server}', to_jsonb(p_payload->>'first_server'));
    END IF;
    
    IF p_payload->'doubles_positions' IS NOT NULL THEN
      v_state := jsonb_set(v_state, '{doubles_positions}', p_payload->'doubles_positions');
    END IF;

    v_state := jsonb_set(v_state, '{serving_side}', '"right"');
    v_state := jsonb_set(v_state, '{last_event_text}', '"match_start"');

  ---------------------------------------------------------------------------
  ELSIF p_type = 'set_formation' THEN
    IF p_payload->'doubles_positions' IS NOT NULL THEN
      v_state := jsonb_set(v_state, '{doubles_positions}', p_payload->'doubles_positions');
    END IF;
    IF p_payload->>'first_server' IS NOT NULL THEN
      v_state := jsonb_set(v_state, '{server}', to_jsonb(p_payload->>'first_server'));
    END IF;
    v_state := jsonb_set(v_state, '{status}', '"live"');
    UPDATE public.ls_matches SET status = 'live' WHERE id = p_match_id;
    v_state := jsonb_set(v_state, '{serving_side}', '"right"');
    v_state := jsonb_set(v_state, '{last_event_text}', '"set_formation"');

  ---------------------------------------------------------------------------
  ELSIF p_type = 'flip_positions' THEN
    v_team := p_payload->>'team';
    IF v_team IS NOT NULL AND v_state->'doubles_positions'->v_team IS NOT NULL THEN
      v_left := v_state->'doubles_positions'->v_team->>'left';
      v_right := v_state->'doubles_positions'->v_team->>'right';
      v_state := jsonb_set(v_state, ARRAY['doubles_positions', v_team, 'left'], to_jsonb(v_right));
      v_state := jsonb_set(v_state, ARRAY['doubles_positions', v_team, 'right'], to_jsonb(v_left));
    END IF;
    v_state := jsonb_set(v_state, '{last_event_text}', '"flip_positions"');

  ---------------------------------------------------------------------------
  ELSIF p_type = 'undo' THEN
    v_history := COALESCE(v_state->'rally_history', '[]');
    IF jsonb_array_length(v_history) > 0 THEN
      v_previous_state := v_history->(jsonb_array_length(v_history) - 1);
      
      v_state := jsonb_set(v_state, ARRAY['scores', v_game_key, 'team_a'], v_previous_state->'score_before'->'team_a');
      v_state := jsonb_set(v_state, ARRAY['scores', v_game_key, 'team_b'], v_previous_state->'score_before'->'team_b');
      v_state := jsonb_set(v_state, '{server}', v_previous_state->'server_before');
      v_state := jsonb_set(v_state, '{serving_side}', v_previous_state->'serving_side_before');
      
      IF v_previous_state->'positions_before' IS NOT NULL THEN
        v_state := jsonb_set(v_state, '{doubles_positions}', v_previous_state->'positions_before');
      END IF;

      -- Remove the last item from array
      v_history := v_history - (jsonb_array_length(v_history) - 1);
      v_state := jsonb_set(v_state, '{rally_history}', v_history);
      
      v_state := jsonb_set(v_state, '{last_event_text}', '"undo"');
    END IF;

  ---------------------------------------------------------------------------
  ELSIF p_type = 'point' OR p_type = 'service_fault' THEN
    IF p_type = 'service_fault' THEN
      IF v_server = 'team_a' THEN
        v_point_winner := 'team_b';
      ELSE
        v_point_winner := 'team_a';
      END IF;
    ELSE
      v_point_winner := COALESCE(p_payload->>'team', v_server);
    END IF;

    -- Store previous state into history
    v_history := COALESCE(v_state->'rally_history', '[]');
    v_previous_state := jsonb_build_object(
      'winner', v_point_winner,
      'score_before', v_state->'scores'->v_game_key,
      'server_before', v_server,
      'serving_side_before', v_serving_side,
      'positions_before', v_state->'doubles_positions'
    );
    IF jsonb_array_length(v_history) >= 15 THEN
      v_history := v_history - 0;
    END IF;
    v_history := v_history || v_previous_state;
    v_state := jsonb_set(v_state, '{rally_history}', v_history);

    -- Increment score for winner
    IF v_point_winner = 'team_a' THEN
      v_new_score_a := v_score_a + 1;
      v_new_score_b := v_score_b;
    ELSE
      v_new_score_a := v_score_a;
      v_new_score_b := v_score_b + 1;
    END IF;

    -- Write new scores into state
    v_state := jsonb_set(v_state, ARRAY['scores', v_game_key, 'team_a'], to_jsonb(v_new_score_a));
    v_state := jsonb_set(v_state, ARRAY['scores', v_game_key, 'team_b'], to_jsonb(v_new_score_b));

    IF v_match_type = 'doubles' AND v_point_winner = v_server THEN
      v_left := v_state->'doubles_positions'->v_point_winner->>'left';
      v_right := v_state->'doubles_positions'->v_point_winner->>'right';
      v_state := jsonb_set(v_state, ARRAY['doubles_positions', v_point_winner, 'left'], to_jsonb(v_right));
      v_state := jsonb_set(v_state, ARRAY['doubles_positions', v_point_winner, 'right'], to_jsonb(v_left));
    END IF;

    v_server := v_point_winner;
    v_state  := jsonb_set(v_state, '{server}', to_jsonb(v_server));

    IF v_server = 'team_a' THEN
      v_server_score := v_new_score_a;
    ELSE
      v_server_score := v_new_score_b;
    END IF;

    IF (v_server_score % 2) = 0 THEN
      v_state := jsonb_set(v_state, '{serving_side}', '"right"');
    ELSE
      v_state := jsonb_set(v_state, '{serving_side}', '"left"');
    END IF;

    -- Check for game win
    v_game_won := false;
    IF v_point_winner = 'team_a' THEN
      v_winner_score := v_new_score_a;
      v_loser_score  := v_new_score_b;
    ELSE
      v_winner_score := v_new_score_b;
      v_loser_score  := v_new_score_a;
    END IF;

    IF (v_winner_score >= 21 AND (v_winner_score - v_loser_score) >= 2) OR v_winner_score = 30 THEN
      v_game_won := true;
    END IF;

    IF v_game_won THEN
      IF v_point_winner = 'team_a' THEN
        v_games_won_a := v_games_won_a + 1;
        v_state := jsonb_set(v_state, '{games_won, team_a}', to_jsonb(v_games_won_a));
      ELSE
        v_games_won_b := v_games_won_b + 1;
        v_state := jsonb_set(v_state, '{games_won, team_b}', to_jsonb(v_games_won_b));
      END IF;

      -- Check if match is over
      IF v_games_won_a = 2 OR v_games_won_b = 2 THEN
        v_state := jsonb_set(v_state, '{status}', '"completed"');
        v_state := jsonb_set(v_state, '{last_event_text}', '"match_end"');
        UPDATE public.ls_matches SET status = 'completed' WHERE id = p_match_id;
      ELSE
        v_state := jsonb_set(v_state, '{current_game}', to_jsonb(v_current_game + 1));
        v_state := jsonb_set(v_state, '{status}', '"interval"');
        v_state := jsonb_set(v_state, '{last_event_text}', '"game_won"');
        v_state := jsonb_set(v_state, '{rally_history}', '[]');
      END IF;
    ELSE
      v_state := jsonb_set(v_state, '{last_event_text}', '"point"');
    END IF;

    -- Mid-game interval check
    IF NOT v_game_won 
       AND (v_new_score_a = 11 OR v_new_score_b = 11)
       AND (v_new_score_a + v_new_score_b) <= 11 THEN
      v_state := jsonb_set(v_state, '{status}', '"interval"');
      v_state := jsonb_set(v_state, '{last_event_text}', '"interval"');
    END IF;

  ---------------------------------------------------------------------------
  ELSIF p_type = 'game_start' THEN
    v_state := jsonb_set(v_state, '{status}', '"live"');
    v_state := jsonb_set(v_state, '{last_event_text}', '"game_start"');

  ---------------------------------------------------------------------------
  ELSIF p_type = 'let' THEN
    v_state := jsonb_set(v_state, '{last_event_text}', '"let"');

  ---------------------------------------------------------------------------
  ELSIF p_type = 'match_end' THEN
    v_state := jsonb_set(v_state, '{status}', '"completed"');
    v_state := jsonb_set(v_state, '{last_event_text}', '"match_end"');
    UPDATE public.ls_matches SET status = 'completed' WHERE id = p_match_id;
  END IF;

  ---------------------------------------------------------------------------
  -- 4. Log event and update snapshot
  ---------------------------------------------------------------------------
  INSERT INTO public.ls_events(match_id, sport, type, payload)
  VALUES (p_match_id, 'badminton', p_type, p_payload);

  UPDATE public.ls_match_state
  SET state      = v_state,
      updated_at = now()
  WHERE match_id = p_match_id;

END;
$$;
