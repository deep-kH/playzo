-- Fix: Added missing p_is_wicket argument in public.process_ball call
CREATE OR REPLACE FUNCTION public.rpc_process_ball_atomic(
  p_match_id uuid,
  p_runs_bat integer,
  p_runs_extra integer,
  p_extra_type text,
  p_is_wicket boolean,
  p_wicket_type text,
  p_wicket_player_id uuid,
  p_fielder_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.process_ball(
    p_match_id,
    p_runs_bat,
    p_runs_extra,
    p_extra_type,
    p_is_wicket, -- Fix: added p_is_wicket
    (CASE WHEN length(p_wicket_type) = 0 THEN NULL ELSE p_wicket_type END)::public.wicket_type,
    p_wicket_player_id,
    p_fielder_id
  );
END;
$$;
