-- ============================================================================
-- Football Rebuild V5: New stats tables + recompute engine + undo + end match
-- ============================================================================

-- ── 1. Create fb_player_match_stats (derived from JSONB events via recompute) ──
CREATE TABLE IF NOT EXISTS public.fb_player_match_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.ls_matches(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL DEFAULT '',
  goals INT NOT NULL DEFAULT 0,
  assists INT NOT NULL DEFAULT 0,
  shots_on INT NOT NULL DEFAULT 0,
  shots_off INT NOT NULL DEFAULT 0,
  fouls_committed INT NOT NULL DEFAULT 0,
  fouls_drawn INT NOT NULL DEFAULT 0,
  yellow_cards INT NOT NULL DEFAULT 0,
  red_cards INT NOT NULL DEFAULT 0,
  saves INT NOT NULL DEFAULT 0,
  blocks INT NOT NULL DEFAULT 0,
  interceptions INT NOT NULL DEFAULT 0,
  clearances INT NOT NULL DEFAULT 0,
  dribbles INT NOT NULL DEFAULT 0,
  chances_created INT NOT NULL DEFAULT 0,
  minutes_played INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (match_id, player_id)
);

-- ── 2. Create fb_player_tournament_stats (aggregated on match end) ──
CREATE TABLE IF NOT EXISTS public.fb_player_tournament_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.ls_tournaments(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL DEFAULT '',
  matches_played INT NOT NULL DEFAULT 0,
  goals INT NOT NULL DEFAULT 0,
  assists INT NOT NULL DEFAULT 0,
  shots_on INT NOT NULL DEFAULT 0,
  shots_off INT NOT NULL DEFAULT 0,
  fouls INT NOT NULL DEFAULT 0,
  yellow_cards INT NOT NULL DEFAULT 0,
  red_cards INT NOT NULL DEFAULT 0,
  saves INT NOT NULL DEFAULT 0,
  blocks INT NOT NULL DEFAULT 0,
  interceptions INT NOT NULL DEFAULT 0,
  clearances INT NOT NULL DEFAULT 0,
  dribbles INT NOT NULL DEFAULT 0,
  chances_created INT NOT NULL DEFAULT 0,
  clean_sheets INT NOT NULL DEFAULT 0,
  rating_score NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, player_id)
);

-- ── 3. Indexes ──
CREATE INDEX IF NOT EXISTS idx_fb_pms_match ON public.fb_player_match_stats(match_id);
CREATE INDEX IF NOT EXISTS idx_fb_pms_player ON public.fb_player_match_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_fb_pts_tournament ON public.fb_player_tournament_stats(tournament_id);
CREATE INDEX IF NOT EXISTS idx_fb_pts_rating ON public.fb_player_tournament_stats(tournament_id, rating_score DESC);

-- ── 4. RLS Policies ──
ALTER TABLE public.fb_player_match_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fb_player_tournament_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read fb_player_match_stats" ON public.fb_player_match_stats;
CREATE POLICY "public read fb_player_match_stats"
  ON public.fb_player_match_stats FOR SELECT USING (true);

DROP POLICY IF EXISTS "public read fb_player_tournament_stats" ON public.fb_player_tournament_stats;
CREATE POLICY "public read fb_player_tournament_stats"
  ON public.fb_player_tournament_stats FOR SELECT USING (true);

-- ============================================================================
-- 5. RECOMPUTE ENGINE: rpc_football_recompute_stats
--    Given a match_id, reads the JSONB events array, resets + rebuilds
--    team_a_stats, team_b_stats, player_stats in ls_match_state,
--    and upserts fb_player_match_stats rows.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_football_recompute_stats(
  p_match_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state JSONB;
  v_events JSONB;
  v_event JSONB;
  v_i INT;

  -- Team stats accumulators
  v_ta JSONB;
  v_tb JSONB;

  -- Player stats map: { player_id: { goals: N, ... } }
  v_ps JSONB := '{}'::jsonb;

  -- Per-event fields
  v_type TEXT;
  v_team TEXT;
  v_pid TEXT;
  v_assist_id TEXT;
  v_fouled_id TEXT;
  v_meta JSONB;
  v_restart TEXT;

  -- Temp player stat
  v_cur JSONB;

  -- For upsert loop
  v_key TEXT;
  v_val JSONB;

  -- Match info for team_id resolution
  v_team_a_id UUID;
  v_team_b_id UUID;
BEGIN
  -- Load state
  SELECT state INTO v_state
  FROM public.ls_match_state
  WHERE match_id = p_match_id;

  IF v_state IS NULL THEN RETURN; END IF;

  -- Get team IDs from match
  SELECT team_a_id, team_b_id INTO v_team_a_id, v_team_b_id
  FROM public.ls_matches WHERE id = p_match_id;

  v_events := COALESCE(v_state->'events', '[]'::jsonb);

  -- Reset team stats
  v_ta := jsonb_build_object(
    'goals', 0, 'corners', 0, 'fouls', 0, 'yellow_cards', 0, 'red_cards', 0,
    'offsides', 0, 'shots_on_target', 0, 'shots_off_target', 0,
    'goal_kicks', 0, 'throw_ins', 0, 'free_kicks', 0, 'saves', 0
  );
  v_tb := v_ta;

  -- Iterate events
  FOR v_i IN 0..jsonb_array_length(v_events) - 1 LOOP
    v_event := v_events->v_i;
    v_type := v_event->>'type';
    v_team := v_event->>'team';
    v_pid := v_event->>'player_id';
    v_assist_id := v_event->>'assist_player_id';
    v_fouled_id := v_event->>'fouled_player_id';
    v_restart := v_event->>'restart';

    -- ── Team stats ──
    IF v_team IN ('team_a', 'team_b') THEN
      IF v_type = 'goal' THEN
        IF v_team = 'team_a' THEN
          v_ta := jsonb_set(v_ta, '{goals}', to_jsonb((v_ta->>'goals')::int + 1));
          v_ta := jsonb_set(v_ta, '{shots_on_target}', to_jsonb((v_ta->>'shots_on_target')::int + 1));
        ELSE
          v_tb := jsonb_set(v_tb, '{goals}', to_jsonb((v_tb->>'goals')::int + 1));
          v_tb := jsonb_set(v_tb, '{shots_on_target}', to_jsonb((v_tb->>'shots_on_target')::int + 1));
        END IF;

      ELSIF v_type = 'own_goal' THEN
        -- Own goal: scored by opponent, credited to the other team
        IF v_team = 'team_a' THEN
          v_tb := jsonb_set(v_tb, '{goals}', to_jsonb((v_tb->>'goals')::int + 1));
        ELSE
          v_ta := jsonb_set(v_ta, '{goals}', to_jsonb((v_ta->>'goals')::int + 1));
        END IF;

      ELSIF v_type = 'shot_on_target' THEN
        IF v_team = 'team_a' THEN
          v_ta := jsonb_set(v_ta, '{shots_on_target}', to_jsonb((v_ta->>'shots_on_target')::int + 1));
          -- Opponent GK save
          v_tb := jsonb_set(v_tb, '{saves}', to_jsonb((v_tb->>'saves')::int + 1));
        ELSE
          v_tb := jsonb_set(v_tb, '{shots_on_target}', to_jsonb((v_tb->>'shots_on_target')::int + 1));
          v_ta := jsonb_set(v_ta, '{saves}', to_jsonb((v_ta->>'saves')::int + 1));
        END IF;

      ELSIF v_type = 'shot_off_target' THEN
        IF v_team = 'team_a' THEN
          v_ta := jsonb_set(v_ta, '{shots_off_target}', to_jsonb((v_ta->>'shots_off_target')::int + 1));
        ELSE
          v_tb := jsonb_set(v_tb, '{shots_off_target}', to_jsonb((v_tb->>'shots_off_target')::int + 1));
        END IF;

      ELSIF v_type = 'corner' THEN
        IF v_team = 'team_a' THEN
          v_ta := jsonb_set(v_ta, '{corners}', to_jsonb((v_ta->>'corners')::int + 1));
        ELSE
          v_tb := jsonb_set(v_tb, '{corners}', to_jsonb((v_tb->>'corners')::int + 1));
        END IF;

      ELSIF v_type = 'goal_kick' THEN
        IF v_team = 'team_a' THEN
          v_ta := jsonb_set(v_ta, '{goal_kicks}', to_jsonb((v_ta->>'goal_kicks')::int + 1));
        ELSE
          v_tb := jsonb_set(v_tb, '{goal_kicks}', to_jsonb((v_tb->>'goal_kicks')::int + 1));
        END IF;

      ELSIF v_type = 'throw_in' THEN
        IF v_team = 'team_a' THEN
          v_ta := jsonb_set(v_ta, '{throw_ins}', to_jsonb((v_ta->>'throw_ins')::int + 1));
        ELSE
          v_tb := jsonb_set(v_tb, '{throw_ins}', to_jsonb((v_tb->>'throw_ins')::int + 1));
        END IF;

      ELSIF v_type = 'foul' THEN
        IF v_team = 'team_a' THEN
          v_ta := jsonb_set(v_ta, '{fouls}', to_jsonb((v_ta->>'fouls')::int + 1));
        ELSE
          v_tb := jsonb_set(v_tb, '{fouls}', to_jsonb((v_tb->>'fouls')::int + 1));
        END IF;

      ELSIF v_type = 'yellow_card' THEN
        IF v_team = 'team_a' THEN
          v_ta := jsonb_set(v_ta, '{yellow_cards}', to_jsonb((v_ta->>'yellow_cards')::int + 1));
          v_ta := jsonb_set(v_ta, '{fouls}', to_jsonb((v_ta->>'fouls')::int + 1));
        ELSE
          v_tb := jsonb_set(v_tb, '{yellow_cards}', to_jsonb((v_tb->>'yellow_cards')::int + 1));
          v_tb := jsonb_set(v_tb, '{fouls}', to_jsonb((v_tb->>'fouls')::int + 1));
        END IF;

      ELSIF v_type = 'red_card' THEN
        IF v_team = 'team_a' THEN
          v_ta := jsonb_set(v_ta, '{red_cards}', to_jsonb((v_ta->>'red_cards')::int + 1));
        ELSE
          v_tb := jsonb_set(v_tb, '{red_cards}', to_jsonb((v_tb->>'red_cards')::int + 1));
        END IF;

      ELSIF v_type = 'offside' THEN
        IF v_team = 'team_a' THEN
          v_ta := jsonb_set(v_ta, '{offsides}', to_jsonb((v_ta->>'offsides')::int + 1));
        ELSE
          v_tb := jsonb_set(v_tb, '{offsides}', to_jsonb((v_tb->>'offsides')::int + 1));
        END IF;

      ELSIF v_type = 'free_kick' THEN
        IF v_team = 'team_a' THEN
          v_ta := jsonb_set(v_ta, '{free_kicks}', to_jsonb((v_ta->>'free_kicks')::int + 1));
        ELSE
          v_tb := jsonb_set(v_tb, '{free_kicks}', to_jsonb((v_tb->>'free_kicks')::int + 1));
        END IF;
      END IF;

      -- Handle restart events from shots / fouls → auto-increment team counters
      IF v_restart IS NOT NULL AND v_restart <> '' AND v_restart <> 'none' THEN
        IF v_restart = 'corner' OR v_restart = 'corner_kick' THEN
          IF v_team = 'team_a' THEN
            v_ta := jsonb_set(v_ta, '{corners}', to_jsonb((v_ta->>'corners')::int + 1));
          ELSE
            v_tb := jsonb_set(v_tb, '{corners}', to_jsonb((v_tb->>'corners')::int + 1));
          END IF;
        ELSIF v_restart = 'goal_kick' THEN
          -- Goal kick goes to opposing team
          IF v_team = 'team_a' THEN
            v_tb := jsonb_set(v_tb, '{goal_kicks}', to_jsonb((v_tb->>'goal_kicks')::int + 1));
          ELSE
            v_ta := jsonb_set(v_ta, '{goal_kicks}', to_jsonb((v_ta->>'goal_kicks')::int + 1));
          END IF;
        ELSIF v_restart = 'free_kick' THEN
          -- Free kick awarded to opposing team (from foul)
          IF v_team = 'team_a' THEN
            v_tb := jsonb_set(v_tb, '{free_kicks}', to_jsonb((v_tb->>'free_kicks')::int + 1));
          ELSE
            v_ta := jsonb_set(v_ta, '{free_kicks}', to_jsonb((v_ta->>'free_kicks')::int + 1));
          END IF;
        END IF;
      END IF;
    END IF;

    -- ── Player stats ──
    IF v_pid IS NOT NULL AND v_pid <> '' THEN
      v_cur := COALESCE(v_ps->v_pid, jsonb_build_object(
        'goals', 0, 'assists', 0, 'shots_on', 0, 'shots_off', 0,
        'fouls_committed', 0, 'fouls_drawn', 0, 'yellow_cards', 0, 'red_cards', 0,
        'saves', 0, 'blocks', 0, 'interceptions', 0, 'clearances', 0,
        'dribbles', 0, 'chances_created', 0, 'team', COALESCE(v_team, '')
      ));

      IF v_type = 'goal' THEN
        v_cur := jsonb_set(v_cur, '{goals}', to_jsonb((v_cur->>'goals')::int + 1));
        v_cur := jsonb_set(v_cur, '{shots_on}', to_jsonb((v_cur->>'shots_on')::int + 1));
      ELSIF v_type = 'shot_on_target' THEN
        v_cur := jsonb_set(v_cur, '{shots_on}', to_jsonb((v_cur->>'shots_on')::int + 1));
      ELSIF v_type = 'shot_off_target' THEN
        v_cur := jsonb_set(v_cur, '{shots_off}', to_jsonb((v_cur->>'shots_off')::int + 1));
      ELSIF v_type = 'foul' THEN
        v_cur := jsonb_set(v_cur, '{fouls_committed}', to_jsonb((v_cur->>'fouls_committed')::int + 1));
      ELSIF v_type = 'yellow_card' THEN
        v_cur := jsonb_set(v_cur, '{yellow_cards}', to_jsonb((v_cur->>'yellow_cards')::int + 1));
      ELSIF v_type = 'red_card' THEN
        v_cur := jsonb_set(v_cur, '{red_cards}', to_jsonb((v_cur->>'red_cards')::int + 1));
      ELSIF v_type = 'interception' THEN
        v_cur := jsonb_set(v_cur, '{interceptions}', to_jsonb((v_cur->>'interceptions')::int + 1));
      ELSIF v_type = 'block' THEN
        v_cur := jsonb_set(v_cur, '{blocks}', to_jsonb((v_cur->>'blocks')::int + 1));
      ELSIF v_type = 'clearance' THEN
        v_cur := jsonb_set(v_cur, '{clearances}', to_jsonb((v_cur->>'clearances')::int + 1));
      ELSIF v_type = 'dribble' THEN
        v_cur := jsonb_set(v_cur, '{dribbles}', to_jsonb((v_cur->>'dribbles')::int + 1));
      ELSIF v_type = 'chance_created' THEN
        v_cur := jsonb_set(v_cur, '{chances_created}', to_jsonb((v_cur->>'chances_created')::int + 1));
      ELSIF v_type = 'save' THEN
        v_cur := jsonb_set(v_cur, '{saves}', to_jsonb((v_cur->>'saves')::int + 1));
      END IF;

      v_ps := jsonb_set(v_ps, ARRAY[v_pid], v_cur);
    END IF;

    -- Assist player
    IF v_type = 'goal' AND v_assist_id IS NOT NULL AND v_assist_id <> '' THEN
      v_cur := COALESCE(v_ps->v_assist_id, jsonb_build_object(
        'goals', 0, 'assists', 0, 'shots_on', 0, 'shots_off', 0,
        'fouls_committed', 0, 'fouls_drawn', 0, 'yellow_cards', 0, 'red_cards', 0,
        'saves', 0, 'blocks', 0, 'interceptions', 0, 'clearances', 0,
        'dribbles', 0, 'chances_created', 0, 'team', COALESCE(v_team, '')
      ));
      v_cur := jsonb_set(v_cur, '{assists}', to_jsonb((v_cur->>'assists')::int + 1));
      v_ps := jsonb_set(v_ps, ARRAY[v_assist_id], v_cur);
    END IF;

    -- Fouled player
    IF v_type = 'foul' AND v_fouled_id IS NOT NULL AND v_fouled_id <> '' THEN
      v_cur := COALESCE(v_ps->v_fouled_id, jsonb_build_object(
        'goals', 0, 'assists', 0, 'shots_on', 0, 'shots_off', 0,
        'fouls_committed', 0, 'fouls_drawn', 0, 'yellow_cards', 0, 'red_cards', 0,
        'saves', 0, 'blocks', 0, 'interceptions', 0, 'clearances', 0,
        'dribbles', 0, 'chances_created', 0, 'team', ''
      ));
      v_cur := jsonb_set(v_cur, '{fouls_drawn}', to_jsonb((v_cur->>'fouls_drawn')::int + 1));
      v_ps := jsonb_set(v_ps, ARRAY[v_fouled_id], v_cur);
    END IF;

    -- Shot on target → opposing GK save (player-level)
    IF v_type = 'shot_on_target' THEN
      DECLARE
        v_gk_id TEXT := v_event->>'opposing_gk_id';
      BEGIN
        IF v_gk_id IS NOT NULL AND v_gk_id <> '' THEN
          v_cur := COALESCE(v_ps->v_gk_id, jsonb_build_object(
            'goals', 0, 'assists', 0, 'shots_on', 0, 'shots_off', 0,
            'fouls_committed', 0, 'fouls_drawn', 0, 'yellow_cards', 0, 'red_cards', 0,
            'saves', 0, 'blocks', 0, 'interceptions', 0, 'clearances', 0,
            'dribbles', 0, 'chances_created', 0, 'team', ''
          ));
          v_cur := jsonb_set(v_cur, '{saves}', to_jsonb((v_cur->>'saves')::int + 1));
          v_ps := jsonb_set(v_ps, ARRAY[v_gk_id], v_cur);
        END IF;
      END;
    END IF;

  END LOOP;

  -- Write recomputed stats back to the state snapshot
  v_state := jsonb_set(v_state, '{team_a_stats}', v_ta);
  v_state := jsonb_set(v_state, '{team_b_stats}', v_tb);
  v_state := jsonb_set(v_state, '{player_stats}', v_ps);

  UPDATE public.ls_match_state
  SET state = v_state, updated_at = now()
  WHERE match_id = p_match_id;

  -- ── Upsert fb_player_match_stats ──
  -- Delete existing rows for this match then re-insert
  DELETE FROM public.fb_player_match_stats WHERE match_id = p_match_id;

  FOR v_key, v_val IN SELECT * FROM jsonb_each(v_ps)
  LOOP
    INSERT INTO public.fb_player_match_stats (
      match_id, player_id, team_id, player_name,
      goals, assists, shots_on, shots_off,
      fouls_committed, fouls_drawn, yellow_cards, red_cards,
      saves, blocks, interceptions, clearances,
      dribbles, chances_created
    )
    SELECT
      p_match_id,
      v_key::uuid,
      CASE
        WHEN (v_val->>'team') = 'team_a' THEN v_team_a_id
        ELSE v_team_b_id
      END,
      COALESCE((SELECT name FROM public.players WHERE id = v_key::uuid), ''),
      COALESCE((v_val->>'goals')::int, 0),
      COALESCE((v_val->>'assists')::int, 0),
      COALESCE((v_val->>'shots_on')::int, 0),
      COALESCE((v_val->>'shots_off')::int, 0),
      COALESCE((v_val->>'fouls_committed')::int, 0),
      COALESCE((v_val->>'fouls_drawn')::int, 0),
      COALESCE((v_val->>'yellow_cards')::int, 0),
      COALESCE((v_val->>'red_cards')::int, 0),
      COALESCE((v_val->>'saves')::int, 0),
      COALESCE((v_val->>'blocks')::int, 0),
      COALESCE((v_val->>'interceptions')::int, 0),
      COALESCE((v_val->>'clearances')::int, 0),
      COALESCE((v_val->>'dribbles')::int, 0),
      COALESCE((v_val->>'chances_created')::int, 0)
    ON CONFLICT (match_id, player_id) DO UPDATE SET
      goals = EXCLUDED.goals,
      assists = EXCLUDED.assists,
      shots_on = EXCLUDED.shots_on,
      shots_off = EXCLUDED.shots_off,
      fouls_committed = EXCLUDED.fouls_committed,
      fouls_drawn = EXCLUDED.fouls_drawn,
      yellow_cards = EXCLUDED.yellow_cards,
      red_cards = EXCLUDED.red_cards,
      saves = EXCLUDED.saves,
      blocks = EXCLUDED.blocks,
      interceptions = EXCLUDED.interceptions,
      clearances = EXCLUDED.clearances,
      dribbles = EXCLUDED.dribbles,
      chances_created = EXCLUDED.chances_created,
      updated_at = now();
  END LOOP;

END;
$$;


-- ============================================================================
-- 6. REWRITTEN rpc_process_football
--    Handles phase transitions + appends events + calls recompute
-- ============================================================================
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
  v_is_paused BOOLEAN;

  -- Clock
  v_clock_running BOOLEAN;
  v_last_start_time TEXT;
  v_elapsed_seconds INT;

  -- Event building
  v_event JSONB;
  v_events JSONB;
  v_event_id TEXT;
  v_penalties JSONB;
  v_penalty_order INT;
  v_team TEXT;
  v_phase TEXT;
BEGIN
  -- 1. Lock and load
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

  -- Extract common fields
  v_team := p_payload->>'team';
  v_phase := v_state->>'phase';
  v_clock_running := COALESCE((v_state->>'clock_running')::boolean, false);
  v_last_start_time := v_state->>'last_clock_start_time';
  v_elapsed_seconds := COALESCE((v_state->>'elapsed_seconds')::int, 0);
  v_events := COALESCE(v_state->'events', '[]'::jsonb);
  v_penalties := COALESCE(v_state->'penalties', '[]'::jsonb);

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
    v_state := jsonb_set(v_state, '{elapsed_seconds}', '0'::jsonb);
    v_state := jsonb_set(v_state, '{added_extra_time_minutes}', '0'::jsonb);
    -- Save extra time duration from payload
    IF (p_payload->>'extra_time_duration') IS NOT NULL THEN
      v_state := jsonb_set(v_state, '{extra_time_duration_minutes}', to_jsonb((p_payload->>'extra_time_duration')::int));
    END IF;

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
    v_state := jsonb_set(v_state, '{elapsed_seconds}', '0'::jsonb);

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
  -- 5. In-game events: Append to timeline (stats handled by recompute)
  ---------------------------------------------------------------------------
  ELSE
    -- Build event entry for timeline
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
      'opposing_gk_id', p_payload->>'opposing_gk_id',
      'match_time_seconds', v_elapsed_seconds,
      'half', v_phase,
      'restart', COALESCE(p_payload->>'restart', ''),
      'card', COALESCE(p_payload->>'card', ''),
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

  -- Set last_event_text for UI overlays
  v_state := jsonb_set(v_state, '{last_event_text}', to_jsonb(p_type));

  -- Insert audit log
  INSERT INTO public.ls_events(match_id, sport, type, payload)
  VALUES (p_match_id, 'football', p_type, p_payload);

  -- Save state snapshot (before recompute so the events are persisted)
  UPDATE public.ls_match_state
  SET state = v_state, updated_at = now()
  WHERE match_id = p_match_id;

  -- ── Run recompute for in-game events ──
  IF p_type NOT IN (
    'match_start', 'match_pause', 'match_resume', 'extra_time_added',
    'half_time', 'second_half_start', 'full_time', 'match_end',
    'extra_time_start', 'extra_time_half', 'extra_time_second_start',
    'penalty_shootout_start', 'penalty_goal', 'penalty_miss'
  ) THEN
    PERFORM public.rpc_football_recompute_stats(p_match_id);
  END IF;

  -- ── On match end, aggregate to tournament stats ──
  IF p_type = 'match_end' THEN
    PERFORM public.rpc_football_end_match(p_match_id);
  END IF;

END;
$$;


-- ============================================================================
-- 7. UNDO LAST EVENT: Pop last event from JSONB array + recompute
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_football_undo_last_event(
  p_match_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state JSONB;
  v_events JSONB;
  v_len INT;
BEGIN
  SELECT state INTO v_state
  FROM public.ls_match_state
  WHERE match_id = p_match_id
  FOR UPDATE;

  IF v_state IS NULL THEN
    RAISE EXCEPTION 'No match state found for %', p_match_id;
  END IF;

  v_events := COALESCE(v_state->'events', '[]'::jsonb);
  v_len := jsonb_array_length(v_events);

  IF v_len = 0 THEN
    RAISE EXCEPTION 'No events to undo';
  END IF;

  -- Pop the last element
  v_events := v_events - (v_len - 1);
  v_state := jsonb_set(v_state, '{events}', v_events);

  -- Save state with popped events
  UPDATE public.ls_match_state
  SET state = v_state, updated_at = now()
  WHERE match_id = p_match_id;

  -- Recompute all stats from the remaining events
  PERFORM public.rpc_football_recompute_stats(p_match_id);
END;
$$;


-- ============================================================================
-- 8. END MATCH: Aggregate fb_player_match_stats → fb_player_tournament_stats
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_football_end_match(
  p_match_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tournament_id UUID;
  v_team_a_goals INT;
  v_team_b_goals INT;
  v_team_a_id UUID;
  v_team_b_id UUID;
  v_state JSONB;
BEGIN
  -- Get tournament_id and team IDs
  SELECT tournament_id, team_a_id, team_b_id
  INTO v_tournament_id, v_team_a_id, v_team_b_id
  FROM public.ls_matches
  WHERE id = p_match_id;

  IF v_tournament_id IS NULL THEN RETURN; END IF;

  -- Get final scores for clean sheet calculation
  SELECT state INTO v_state FROM public.ls_match_state WHERE match_id = p_match_id;
  v_team_a_goals := COALESCE((v_state->'team_a_stats'->>'goals')::int, 0);
  v_team_b_goals := COALESCE((v_state->'team_b_stats'->>'goals')::int, 0);

  -- Upsert tournament stats from match stats
  INSERT INTO public.fb_player_tournament_stats (
    tournament_id, player_id, team_id, player_name,
    matches_played, goals, assists, shots_on, shots_off,
    fouls, yellow_cards, red_cards,
    saves, blocks, interceptions, clearances,
    dribbles, chances_created, clean_sheets, rating_score
  )
  SELECT
    v_tournament_id,
    pms.player_id,
    pms.team_id,
    pms.player_name,
    1,  -- this match
    pms.goals,
    pms.assists,
    pms.shots_on,
    pms.shots_off,
    pms.fouls_committed,
    pms.yellow_cards,
    pms.red_cards,
    pms.saves,
    pms.blocks,
    pms.interceptions,
    pms.clearances,
    pms.dribbles,
    pms.chances_created,
    -- Clean sheet: GK/DEF gets 1 if their team conceded 0
    CASE
      WHEN pms.team_id = v_team_a_id AND v_team_b_goals = 0 THEN 1
      WHEN pms.team_id = v_team_b_id AND v_team_a_goals = 0 THEN 1
      ELSE 0
    END,
    -- MVP formula
    (pms.goals * 4 + pms.assists * 3 + pms.saves * 2 +
     pms.interceptions * 1.5 + pms.blocks * 1.5 + pms.dribbles * 1)
  FROM public.fb_player_match_stats pms
  WHERE pms.match_id = p_match_id
  ON CONFLICT (tournament_id, player_id) DO UPDATE SET
    matches_played = fb_player_tournament_stats.matches_played + 1,
    goals = fb_player_tournament_stats.goals + EXCLUDED.goals,
    assists = fb_player_tournament_stats.assists + EXCLUDED.assists,
    shots_on = fb_player_tournament_stats.shots_on + EXCLUDED.shots_on,
    shots_off = fb_player_tournament_stats.shots_off + EXCLUDED.shots_off,
    fouls = fb_player_tournament_stats.fouls + EXCLUDED.fouls,
    yellow_cards = fb_player_tournament_stats.yellow_cards + EXCLUDED.yellow_cards,
    red_cards = fb_player_tournament_stats.red_cards + EXCLUDED.red_cards,
    saves = fb_player_tournament_stats.saves + EXCLUDED.saves,
    blocks = fb_player_tournament_stats.blocks + EXCLUDED.blocks,
    interceptions = fb_player_tournament_stats.interceptions + EXCLUDED.interceptions,
    clearances = fb_player_tournament_stats.clearances + EXCLUDED.clearances,
    dribbles = fb_player_tournament_stats.dribbles + EXCLUDED.dribbles,
    chances_created = fb_player_tournament_stats.chances_created + EXCLUDED.chances_created,
    clean_sheets = fb_player_tournament_stats.clean_sheets + EXCLUDED.clean_sheets,
    -- Recalculate rating from new totals
    rating_score = (
      (fb_player_tournament_stats.goals + EXCLUDED.goals) * 4 +
      (fb_player_tournament_stats.assists + EXCLUDED.assists) * 3 +
      (fb_player_tournament_stats.saves + EXCLUDED.saves) * 2 +
      (fb_player_tournament_stats.interceptions + EXCLUDED.interceptions) * 1.5 +
      (fb_player_tournament_stats.blocks + EXCLUDED.blocks) * 1.5 +
      (fb_player_tournament_stats.dribbles + EXCLUDED.dribbles) * 1
    ),
    player_name = EXCLUDED.player_name,
    updated_at = now();

END;
$$;
