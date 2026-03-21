-- Phase 1 stabilization for football generic event flow
-- Safe to run on fresh and existing databases.

-- 1) Ensure generic structures exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sport_type') THEN
    CREATE TYPE public.sport_type AS ENUM ('cricket', 'football', 'badminton');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.ls_events (
  id BIGSERIAL PRIMARY KEY,
  match_id UUID REFERENCES public.ls_matches(id) ON DELETE CASCADE,
  sport public.sport_type,
  type TEXT,
  payload JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE public.ls_events
  ADD COLUMN IF NOT EXISTS sport public.sport_type;

ALTER TABLE IF EXISTS public.ls_match_state
  ADD COLUMN IF NOT EXISTS state JSONB,
  ADD COLUMN IF NOT EXISTS is_paused BOOLEAN DEFAULT false;

ALTER TABLE public.ls_events ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ls_events'
      AND policyname = 'public read events'
  ) THEN
    CREATE POLICY "public read events"
      ON public.ls_events
      FOR SELECT
      USING (true);
  END IF;
END $$;

-- 2) Dispatcher hardened:
--    - Resolve sport from tournament (ls_matches has no sport column)
--    - Guard unknown events
--    - Lock football writes after full-time/ended
--    - Reject in-play football actions while clock is paused
CREATE OR REPLACE FUNCTION public.rpc_process_event(
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
  v_sport public.sport_type;
  v_state JSONB;
  v_phase TEXT;
  v_status TEXT;
  v_clock_running BOOLEAN;
BEGIN
  SELECT t.sport::public.sport_type
  INTO v_sport
  FROM public.ls_matches m
  JOIN public.ls_tournaments t ON t.id = m.tournament_id
  WHERE m.id = p_match_id;

  IF v_sport IS NULL THEN
    RAISE EXCEPTION 'Match % not found', p_match_id;
  END IF;

  IF p_type IS NULL OR btrim(p_type) = '' THEN
    RAISE EXCEPTION 'event type is required';
  END IF;

  IF v_sport = 'football' THEN
    SELECT state INTO v_state
    FROM public.ls_match_state
    WHERE match_id = p_match_id;

    v_phase := COALESCE(v_state->>'phase', 'not_started');
    v_status := COALESCE(v_state->>'status', 'scheduled');
    v_clock_running := COALESCE((v_state->>'clock_running')::boolean, false);

    IF v_phase IN ('full_time', 'ended') OR v_status = 'completed' THEN
      RAISE EXCEPTION 'match is locked after full-time';
    END IF;

    IF v_phase IN ('first_half', 'second_half', 'extra_time_first', 'extra_time_second')
       AND v_clock_running = false
       AND p_type NOT IN ('match_resume', 'half_time', 'full_time', 'extra_time_half', 'match_end', 'extra_time_added') THEN
      RAISE EXCEPTION 'cannot record football actions while match clock is paused';
    END IF;
  END IF;

  IF v_sport = 'cricket' THEN
    PERFORM public.rpc_process_cricket_generic(p_match_id, p_type, p_payload);
  ELSIF v_sport = 'badminton' THEN
    PERFORM public.rpc_process_badminton(p_match_id, p_type, p_payload);
  ELSIF v_sport = 'football' THEN
    PERFORM public.rpc_process_football(p_match_id, p_type, p_payload);
  ELSE
    RAISE EXCEPTION 'unsupported sport: %', v_sport;
  END IF;
END;
$$;

