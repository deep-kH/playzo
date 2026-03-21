-- Add computed statistics to ls_match_state
-- These values are calculated by RPC and provided for display
-- UI must read these instead of recalculating locally

begin;

alter table if exists public.ls_match_state
add column if not exists stats jsonb default '{}'::jsonb;

comment on column public.ls_match_state.stats is 'Computed statistics: crr, rrr, projected_score, etc. Updated by rpc_process_ball_atomic. UI reads these values directly, never computes locally.';

commit;
