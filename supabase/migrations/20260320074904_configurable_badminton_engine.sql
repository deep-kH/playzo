-- Migration: Configurable Badminton Engine
-- Replaces the hardcoded scoring with configurable points_per_set, sets_to_win, point_cap.
-- Adds deuce/extension, golden point logic.
-- Adds 'incomplete' status for admin-stopped matches (resumable).
-- Supports up to 5 sets (g1-g5).

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

  -- Config (from state, with defaults)
  v_target_points  INT;
  v_sets_to_win    INT;
  v_point_cap      INT;
  v_total_sets     INT;

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

  -- Deuce/golden point helpers
  v_deuce_threshold INT;

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
      "points_per_set": 21,
      "sets_to_win": 2,
      "point_cap": 30,
      "scores": {
        "g1": {"team_a": 0, "team_b": 0},
        "g2": {"team_a": 0, "team_b": 0},
        "g3": {"team_a": 0, "team_b": 0},
        "g4": {"team_a": 0, "team_b": 0},
        "g5": {"team_a": 0, "team_b": 0}
      },
      "games_won": {"team_a": 0, "team_b": 0},
      "server": "team_a",
      "server_player_id": null,
      "serving_side": "right",
      "doubles_positions": null,
      "rally_history": []
    }'::jsonb;
  END IF;

  -- Ensure rally_history exists
  IF v_state->'rally_history' IS NULL THEN
    v_state := jsonb_set(v_state, '{rally_history}', '[]');
  END IF;

  -- Ensure g4/g5 score slots exist
  IF v_state->'scores'->'g4' IS NULL THEN
    v_state := jsonb_set(v_state, '{scores,g4}', '{"team_a":0,"team_b":0}');
  END IF;
  IF v_state->'scores'->'g5' IS NULL THEN
    v_state := jsonb_set(v_state, '{scores,g5}', '{"team_a":0,"team_b":0}');
  END IF;

  -- Extract frequently used fields
  v_current_game  := COALESCE((v_state->>'current_game')::int, 1);
  v_game_key      := 'g' || v_current_game;
  v_server        := COALESCE(v_state->>'server', 'team_a');
  v_serving_side  := COALESCE(v_state->>'serving_side', 'right');
  v_games_won_a   := COALESCE((v_state->'games_won'->>'team_a')::int, 0);
  v_games_won_b   := COALESCE((v_state->'games_won'->>'team_b')::int, 0);
  v_match_type    := COALESCE(v_state->>'match_type', 'singles');

  -- Configurable scoring (read from state, fall back to defaults)
  v_target_points := COALESCE((v_state->>'points_per_set')::int, 21);
  v_sets_to_win   := COALESCE((v_state->>'sets_to_win')::int, 2);
  v_point_cap     := COALESCE((v_state->>'point_cap')::int, 30);
  v_total_sets    := v_sets_to_win * 2 - 1;
  v_deuce_threshold := v_target_points - 1;

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

    -- Apply scoring config from payload (set during match creation)
    IF p_payload->>'points_per_set' IS NOT NULL THEN
      v_state := jsonb_set(v_state, '{points_per_set}', to_jsonb((p_payload->>'points_per_set')::int));
    END IF;
    IF p_payload->>'sets_to_win' IS NOT NULL THEN
      v_state := jsonb_set(v_state, '{sets_to_win}', to_jsonb((p_payload->>'sets_to_win')::int));
    END IF;
    IF p_payload->>'point_cap' IS NOT NULL THEN
      v_state := jsonb_set(v_state, '{point_cap}', to_jsonb((p_payload->>'point_cap')::int));
    END IF;

    v_state := jsonb_set(v_state, '{serving_side}', '"right"');
    v_state := jsonb_set(v_state, '{last_event_text}', '"match_start"');

  ---------------------------------------------------------------------------
  ELSIF p_type = 'flip_positions' THEN
    v_team := p_payload->>'team';
    IF v_team IS NOT NULL AND v_state->'doubles_positions'->v_team IS NOT NULL THEN
      v_left  := v_state->'doubles_positions'->v_team->>'left';
      v_right := v_state->'doubles_positions'->v_team->>'right';
      v_state := jsonb_set(v_state, ARRAY['doubles_positions', v_team, 'left'],  to_jsonb(v_right));
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
      v_state := jsonb_set(v_state, '{server}',        v_previous_state->'server_before');
      v_state := jsonb_set(v_state, '{serving_side}',  v_previous_state->'serving_side_before');
      IF v_previous_state->'positions_before' IS NOT NULL THEN
        v_state := jsonb_set(v_state, '{doubles_positions}', v_previous_state->'positions_before');
      END IF;
      v_history := v_history - (jsonb_array_length(v_history) - 1);
      v_state := jsonb_set(v_state, '{rally_history}', v_history);
      v_state := jsonb_set(v_state, '{last_event_text}', '"undo"');
    END IF;

  ---------------------------------------------------------------------------
  ELSIF p_type = 'point' OR p_type = 'service_fault' THEN
    -- Determine point winner
    IF p_type = 'service_fault' THEN
      IF v_server = 'team_a' THEN v_point_winner := 'team_b';
      ELSE v_point_winner := 'team_a';
      END IF;
    ELSE
      v_point_winner := COALESCE(p_payload->>'team', v_server);
    END IF;

    -- Store previous state in rally history
    v_history := COALESCE(v_state->'rally_history', '[]');
    v_previous_state := jsonb_build_object(
      'winner',              v_point_winner,
      'score_before',        v_state->'scores'->v_game_key,
      'server_before',       v_server,
      'serving_side_before', v_serving_side,
      'positions_before',    v_state->'doubles_positions'
    );
    IF jsonb_array_length(v_history) >= 15 THEN
      v_history := v_history - 0;
    END IF;
    v_history := v_history || v_previous_state;
    v_state := jsonb_set(v_state, '{rally_history}', v_history);

    -- Increment score
    IF v_point_winner = 'team_a' THEN
      v_new_score_a := v_score_a + 1;
      v_new_score_b := v_score_b;
    ELSE
      v_new_score_a := v_score_a;
      v_new_score_b := v_score_b + 1;
    END IF;

    -- Write new scores
    v_state := jsonb_set(v_state, ARRAY['scores', v_game_key, 'team_a'], to_jsonb(v_new_score_a));
    v_state := jsonb_set(v_state, ARRAY['scores', v_game_key, 'team_b'], to_jsonb(v_new_score_b));

    -- BWF Doubles: server's team wins a rally → service court swap
    IF v_match_type = 'doubles' AND v_point_winner = v_server THEN
      v_left  := v_state->'doubles_positions'->v_point_winner->>'left';
      v_right := v_state->'doubles_positions'->v_point_winner->>'right';
      v_state := jsonb_set(v_state, ARRAY['doubles_positions', v_point_winner, 'left'],  to_jsonb(v_right));
      v_state := jsonb_set(v_state, ARRAY['doubles_positions', v_point_winner, 'right'], to_jsonb(v_left));
    END IF;

    -- Service passes to point winner
    v_server := v_point_winner;
    v_state  := jsonb_set(v_state, '{server}', to_jsonb(v_server));

    -- Serving side: determined by new server's score (even=right, odd=left)
    IF v_server = 'team_a' THEN v_server_score := v_new_score_a;
    ELSE v_server_score := v_new_score_b;
    END IF;
    IF (v_server_score % 2) = 0 THEN
      v_state := jsonb_set(v_state, '{serving_side}', '"right"');
    ELSE
      v_state := jsonb_set(v_state, '{serving_side}', '"left"');
    END IF;

    -- ─── Set Win Logic (Configurable Deuce / Golden Point) ─────────────
    v_game_won := false;

    IF v_point_winner = 'team_a' THEN
      v_winner_score := v_new_score_a;
      v_loser_score  := v_new_score_b;
    ELSE
      v_winner_score := v_new_score_b;
      v_loser_score  := v_new_score_a;
    END IF;

    -- Normal win: reached target AND lead >= 2
    IF v_winner_score >= v_target_points AND (v_winner_score - v_loser_score) >= 2 THEN
      v_game_won := true;
    -- Point cap: any score at cap wins regardless of lead
    ELSIF v_winner_score >= v_point_cap THEN
      v_game_won := true;
    END IF;
    -- No game won if tied or rival is at deuce_threshold (extension continues)

    -- ─── Set won ────────────────────────────────────────────────────────
    IF v_game_won THEN
      IF v_point_winner = 'team_a' THEN
        v_games_won_a := v_games_won_a + 1;
        v_state := jsonb_set(v_state, '{games_won,team_a}', to_jsonb(v_games_won_a));
      ELSE
        v_games_won_b := v_games_won_b + 1;
        v_state := jsonb_set(v_state, '{games_won,team_b}', to_jsonb(v_games_won_b));
      END IF;

      -- Check match winner
      IF v_games_won_a >= v_sets_to_win OR v_games_won_b >= v_sets_to_win THEN
        v_state := jsonb_set(v_state, '{status}', '"completed"');
        v_state := jsonb_set(v_state, '{last_event_text}', '"match_end"');
        UPDATE public.ls_matches SET status = 'completed' WHERE id = p_match_id;
      ELSE
        -- Move to next set
        IF v_current_game < v_total_sets THEN
          v_state := jsonb_set(v_state, '{current_game}', to_jsonb(v_current_game + 1));
        END IF;
        v_state := jsonb_set(v_state, '{status}', '"interval"');
        v_state := jsonb_set(v_state, '{last_event_text}', '"set_won"');
        v_state := jsonb_set(v_state, '{rally_history}', '[]');
      END IF;
    ELSE
      -- Deuce/extension message for UI
      IF v_new_score_a = v_deuce_threshold AND v_new_score_b = v_deuce_threshold THEN
        v_state := jsonb_set(v_state, '{last_event_text}', '"deuce"');
      ELSIF v_new_score_a = (v_point_cap - 1) AND v_new_score_b = (v_point_cap - 1) THEN
        v_state := jsonb_set(v_state, '{last_event_text}', '"golden_point"');
      ELSE
        v_state := jsonb_set(v_state, '{last_event_text}', '"point"');
      END IF;
    END IF;

  ---------------------------------------------------------------------------
  ELSIF p_type = 'game_start' THEN
    -- Admin resumes play after interval
    v_state := jsonb_set(v_state, '{status}', '"live"');
    v_state := jsonb_set(v_state, '{serving_side}', '"right"');
    v_state := jsonb_set(v_state, '{last_event_text}', '"game_start"');

  ---------------------------------------------------------------------------
  ELSIF p_type = 'let' THEN
    v_state := jsonb_set(v_state, '{last_event_text}', '"let"');

  ---------------------------------------------------------------------------
  ELSIF p_type = 'match_end' THEN
    -- Admin explicitly ends match
    -- If neither side has reached sets_to_win, flag as incomplete
    IF v_games_won_a >= v_sets_to_win OR v_games_won_b >= v_sets_to_win THEN
      v_state := jsonb_set(v_state, '{status}', '"completed"');
      UPDATE public.ls_matches SET status = 'completed' WHERE id = p_match_id;
    ELSE
      v_state := jsonb_set(v_state, '{status}', '"incomplete"');
      UPDATE public.ls_matches SET status = 'completed' WHERE id = p_match_id;
    END IF;
    v_state := jsonb_set(v_state, '{last_event_text}', '"match_end"');

  ---------------------------------------------------------------------------
  ELSIF p_type = 'match_resume' THEN
    -- Admin resumes an incomplete match
    v_state := jsonb_set(v_state, '{status}', '"live"');
    UPDATE public.ls_matches SET status = 'live' WHERE id = p_match_id;
    v_state := jsonb_set(v_state, '{last_event_text}', '"match_resume"');

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
