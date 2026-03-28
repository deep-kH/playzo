/**
 * RealtimeManager — Centralized Supabase Realtime subscription manager.
 *
 * Wraps supabase.channel() with:
 *  - Auto-reconnect on CHANNEL_ERROR / TIMED_OUT / CLOSED
 *  - Exponential backoff (1s → 2s → 4s → max 30s)
 *  - Connection lifecycle logging
 *  - Status observable for UI indicators
 *  - Cleanup helper
 *
 * Used by useLiveMatch and should be the ONLY place that creates realtime channels.
 */

import { supabase } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

type StatusListener = (status: ConnectionStatus) => void;

interface SubscribeOptions {
  /** Unique key for the subscription (e.g. `match:${matchId}`) */
  key: string;
  /** Supabase table to listen on */
  table: string;
  /** Row-level filter (e.g. `match_id=eq.${matchId}`) */
  filter: string;
  /** Schema (default: "public") */
  schema?: string;
  /** Callback when a postgres_changes payload arrives */
  onPayload: (payload: any) => void;
  /** Optional callback for connection status changes */
  onStatusChange?: StatusListener;
}

const MAX_BACKOFF_MS = 30_000;
const INITIAL_BACKOFF_MS = 1_000;

export class RealtimeManager {
  private channel: RealtimeChannel | null = null;
  private options: SubscribeOptions | null = null;
  private backoffMs = INITIAL_BACKOFF_MS;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private status: ConnectionStatus = "disconnected";
  private destroyed = false;

  /**
   * Create a managed realtime subscription.
   */
  subscribe(opts: SubscribeOptions): void {
    this.cleanup(); // clear any previous subscription
    this.destroyed = false;
    this.options = opts;
    this.backoffMs = INITIAL_BACKOFF_MS;
    this.createChannel();
  }

  /**
   * Tear down the subscription and all timers.
   */
  cleanup(): void {
    this.destroyed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.setStatus("disconnected");
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  // ──────────────────────────── Private ────────────────────────────

  private setStatus(status: ConnectionStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.options?.onStatusChange?.(status);
  }

  private createChannel(): void {
    if (this.destroyed || !this.options) return;

    const { key, table, filter, schema = "public", onPayload } = this.options;

    this.setStatus(this.backoffMs > INITIAL_BACKOFF_MS ? "reconnecting" : "connecting");

    // Remove previous channel if it exists
    if (this.channel) {
      supabase.removeChannel(this.channel);
    }

    this.channel = supabase
      .channel(`managed:${key}`)
      .on(
        "postgres_changes",
        { event: "*", schema, table, filter },
        (payload) => {
          onPayload(payload);
        }
      )
      .subscribe((status, err) => {
        if (this.destroyed) return;

        switch (status) {
          case "SUBSCRIBED":
            console.log(`[RealtimeManager] ✅ SUBSCRIBED (${key})`);
            this.backoffMs = INITIAL_BACKOFF_MS;
            this.setStatus("connected");
            break;
          case "CHANNEL_ERROR":
            console.warn(`[RealtimeManager] ⚠️ CHANNEL_ERROR (${key})`, err);
            this.scheduleReconnect();
            break;
          case "TIMED_OUT":
            console.warn(`[RealtimeManager] ⏱️ TIMED_OUT (${key})`);
            this.scheduleReconnect();
            break;
          case "CLOSED":
            console.log(`[RealtimeManager] 🔒 CLOSED (${key})`);
            if (!this.destroyed) {
              this.scheduleReconnect();
            }
            break;
        }
      });
  }

  private scheduleReconnect(): void {
    if (this.destroyed) return;

    this.setStatus("reconnecting");

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    console.log(
      `[RealtimeManager] 🔄 Reconnecting in ${this.backoffMs}ms...`
    );

    this.reconnectTimer = setTimeout(() => {
      if (this.destroyed) return;
      this.createChannel();
    }, this.backoffMs);

    // Exponential backoff with cap
    this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);
  }
}
