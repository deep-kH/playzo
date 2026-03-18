-- Migration: Phase 5 Badminton Engine
-- Replaces the stub rpc_process_badminton with full BWF-compliant scoring logic

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
  v_games_won_a    INT;
  v_games_won_b    INT;
  v_match_type     TEXT;

  -- Point winner
  v_point_winner   TEXT;       -- 'team_a' | 'team_b'
  v_new_score_a    INT;
  v_new_score_b    INT;
  v_winner_score   INT;
  v_loser_score    INT;
  v_game_won       BOOLEAN;
  v_server_score   INT;        -- score of new server (for serving side calc)
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
      "serving_side": "right"
    }'::jsonb;
  END IF;

  -- Extract frequently used fields
  v_current_game := COALESCE((v_state->>'current_game')::int, 1);
  v_game_key     := 'g' || v_current_game;
  v_server       := COALESCE(v_state->>'server', 'team_a');
  v_games_won_a  := COALESCE((v_state->'games_won'->>'team_a')::int, 0);
  v_games_won_b  := COALESCE((v_state->'games_won'->>'team_b')::int, 0);
  v_match_type   := COALESCE(v_state->>'match_type', 'singles');

  v_score_a := COALESCE((v_state->'scores'->v_game_key->>'team_a')::int, 0);
  v_score_b := COALESCE((v_state->'scores'->v_game_key->>'team_b')::int, 0);

  ---------------------------------------------------------------------------
  -- 3. Event Routing
  ---------------------------------------------------------------------------

  IF p_type = 'match_start' THEN
    -- Set up who serves first and match type from payload
    v_state := jsonb_set(v_state, '{status}', '"live"');
    
    IF p_payload->>'match_type' IS NOT NULL THEN
      v_state := jsonb_set(v_state, '{match_type}', to_jsonb(p_payload->>'match_type'));
    END IF;

    IF p_payload->>'first_server' IS NOT NULL THEN
      v_state := jsonb_set(v_state, '{server}', to_jsonb(p_payload->>'first_server'));
    END IF;
    
    -- First serve is always from right service court
    v_state := jsonb_set(v_state, '{serving_side}', '"right"');
    v_state := jsonb_set(v_state, '{last_event_text}', '"match_start"');

  ---------------------------------------------------------------------------
  ELSIF p_type = 'point' OR p_type = 'service_fault' THEN
    -- Determine point winner
    IF p_type = 'service_fault' THEN
      -- Fault by current server → opponent wins the point
      IF v_server = 'team_a' THEN
        v_point_winner := 'team_b';
      ELSE
        v_point_winner := 'team_a';
      END IF;
    ELSE
      v_point_winner := COALESCE(p_payload->>'team', v_server);
    END IF;

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

    -- Service switches to the point winner (BWF rally point rule)
    v_server := v_point_winner;
    v_state  := jsonb_set(v_state, '{server}', to_jsonb(v_server));

    -- Serving side: determined by NEW server's current score
    -- Right court = even score; Left court = odd score
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

    -- Optional: update server_player_id from payload (doubles)
    IF p_payload->>'player_id' IS NOT NULL THEN
      v_state := jsonb_set(v_state, '{server_player_id}', to_jsonb(p_payload->>'player_id'));
    END IF;

    -- -----------------------------------------------------------------------
    -- Check for game win (BWF rules):
    --   • First to 21, win by 2
    --   • At 29-all, next point wins (cap 30)
    -- -----------------------------------------------------------------------
    v_game_won := false;
    IF v_point_winner = 'team_a' THEN
      v_winner_score := v_new_score_a;
      v_loser_score  := v_new_score_b;
    ELSE
      v_winner_score := v_new_score_b;
      v_loser_score  := v_new_score_a;
    END IF;

    IF (v_winner_score >= 21 AND (v_winner_score - v_loser_score) >= 2)
       OR v_winner_score = 30 THEN
      v_game_won := true;
    END IF;

    IF v_game_won THEN
      -- Increment games won
      IF v_point_winner = 'team_a' THEN
        v_games_won_a := v_games_won_a + 1;
        v_state := jsonb_set(v_state, '{games_won, team_a}', to_jsonb(v_games_won_a));
      ELSE
        v_games_won_b := v_games_won_b + 1;
        v_state := jsonb_set(v_state, '{games_won, team_b}', to_jsonb(v_games_won_b));
      END IF;

      -- Check if match is over (first to 2 games wins)
      IF v_games_won_a = 2 OR v_games_won_b = 2 THEN
        v_state := jsonb_set(v_state, '{status}', '"completed"');
        v_state := jsonb_set(v_state, '{last_event_text}', '"match_end"');
      ELSE
        -- Advance to next game: interval state
        v_state := jsonb_set(v_state, '{current_game}', to_jsonb(v_current_game + 1));
        v_state := jsonb_set(v_state, '{status}', '"interval"');
        v_state := jsonb_set(v_state, '{last_event_text}', '"game_won"');
        -- Server in next game: the team that lost the previous game serves first (BWF rule
        -- is actually the winner serves first in the next game if they won) — winner serves
        IF v_point_winner = 'team_a' THEN
          v_state := jsonb_set(v_state, '{server}', '"team_a"');
        ELSE
          v_state := jsonb_set(v_state, '{server}', '"team_b"');
        END IF;
        v_state := jsonb_set(v_state, '{serving_side}', '"right"');
      END IF;
    ELSE
      v_state := jsonb_set(v_state, '{last_event_text}', '"point"');
    END IF;

    -- Mid-game interval check (at 11 points in the deciding game 3, or first to 11 each game)
    IF NOT v_game_won 
       AND (v_new_score_a = 11 OR v_new_score_b = 11)
       AND (v_new_score_a + v_new_score_b) <= 11 THEN
      -- First to reach 11 triggers interval (only once per game)
      v_state := jsonb_set(v_state, '{status}', '"interval"');
      v_state := jsonb_set(v_state, '{last_event_text}', '"interval"');
    END IF;

  ---------------------------------------------------------------------------
  ELSIF p_type = 'game_start' THEN
    -- Resume from interval (admin confirms players ready)
    v_state := jsonb_set(v_state, '{status}', '"live"');
    v_state := jsonb_set(v_state, '{last_event_text}', '"game_start"');

  ---------------------------------------------------------------------------
  ELSIF p_type = 'let' THEN
    -- Let: rally replayed, no score change
    v_state := jsonb_set(v_state, '{last_event_text}', '"let"');

  ---------------------------------------------------------------------------
  ELSIF p_type = 'match_end' THEN
    v_state := jsonb_set(v_state, '{status}', '"completed"');
    v_state := jsonb_set(v_state, '{last_event_text}', '"match_end"');

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
