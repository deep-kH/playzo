-- Migration for Phase 3 (Generic Event Engine)
-- Establishes the doc-aligned dual model while keeping the cricket optimized schema intact

-- 0. Ensure sport_type enum exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sport_type') THEN
    CREATE TYPE public.sport_type AS ENUM ('cricket', 'football', 'badminton');
  END IF;
END $$;

-- 1. Create ls_events core log table
CREATE TABLE IF NOT EXISTS public.ls_events (
  id BIGSERIAL PRIMARY KEY,
  match_id UUID REFERENCES public.ls_matches(id) ON DELETE CASCADE,
  sport public.sport_type,
  type TEXT, -- e.g. "run", "wicket", "goal", "rally"
  payload JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS and public read access for realtime
ALTER TABLE public.ls_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read events" ON public.ls_events;
CREATE POLICY "public read events"
ON public.ls_events FOR SELECT USING (true);


-- 2. Add generic state to ls_match_state snapshot table
ALTER TABLE IF EXISTS public.ls_match_state
ADD COLUMN IF NOT EXISTS state JSONB,
ADD COLUMN IF NOT EXISTS is_paused BOOLEAN DEFAULT false;


-- 3. Create the generic event dispatcher RPC
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
BEGIN
  -- Obtain the sport from the tournament linked to this match
  SELECT t.sport::public.sport_type INTO v_sport
  FROM public.ls_matches m
  JOIN public.ls_tournaments t ON t.id = m.tournament_id
  WHERE m.id = p_match_id;

  IF v_sport is NULL THEN
     RAISE EXCEPTION 'Match % not found', p_match_id;
  END IF;

  -- Dispatch to sport-specific processors
  IF v_sport = 'cricket' THEN
    -- Phase 3 minimal patch: Dispatch to upcoming cricket JSON processor
    -- We're not touching existing cricket atomic functions; they'll
    -- gradually transition to JSON processors in subsequent steps.
    PERFORM public.rpc_process_cricket_generic(p_match_id, p_type, p_payload);
  ELSIF v_sport = 'badminton' THEN
    PERFORM public.rpc_process_badminton(p_match_id, p_type, p_payload);
  ELSIF v_sport = 'football' THEN
    PERFORM public.rpc_process_football(p_match_id, p_type, p_payload);
  END IF;
END;
$$;


-- 4. Create placeholder for generic cricket processor
CREATE OR REPLACE FUNCTION public.rpc_process_cricket_generic(
  p_match_id UUID,
  p_type TEXT,
  p_payload JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Stub function to satisfy the dispatcher until fully implemented
  INSERT INTO public.ls_events(match_id, sport, type, payload)
  VALUES (p_match_id, 'cricket', p_type, p_payload);
END;
$$;


-- 5. Create placeholder for upcoming badminton processor
CREATE OR REPLACE FUNCTION public.rpc_process_badminton(
  p_match_id UUID,
  p_type TEXT,
  p_payload JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Stub function
  INSERT INTO public.ls_events(match_id, sport, type, payload)
  VALUES (p_match_id, 'badminton', p_type, p_payload);
END;
$$;


-- 6. Create placeholder for upcoming football processor
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
BEGIN
  -- Stub function
  INSERT INTO public.ls_events(match_id, sport, type, payload)
  VALUES (p_match_id, 'football', p_type, p_payload);
END;
$$;
