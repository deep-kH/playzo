/* Scoring core — shared types across all sports */
import type { Json } from "@/lib/types/database";

/** Generic event that any sport can emit */
export interface ScoringEvent {
  matchId: string;
  type: string;
  payload: Json;
}

/** Match snapshot state (generic — sport-specific data lives inside `state` JSONB) */
export interface GenericMatchState {
  match_id: string;
  state: Record<string, unknown> | null;
  is_paused: boolean;
  updated_at: string;
}
