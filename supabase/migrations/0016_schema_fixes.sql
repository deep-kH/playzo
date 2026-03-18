-- Migration to fix schema mismatches (Phase 1 Stabilization)
-- Add sold_team_id to players table as referenced by the application

ALTER TABLE IF EXISTS public.players
ADD COLUMN IF NOT EXISTS sold_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;
