/**
 * usePollingFallback — Polling backup system.
 *
 * Only activates when realtime is unhealthy (disconnected/reconnecting).
 * Stops polling when realtime is connected.
 * Uses a ref lock to skip polls when a fetch is already in flight.
 *
 * STABILITY: Uses refs for the poll callback to prevent the interval
 * from being torn down and recreated on every render.
 */
"use client";

import { useEffect, useRef } from "react";
import type { ConnectionStatus } from "./RealtimeManager";

interface UsePollingFallbackOptions {
  /** Callback to poll data */
  onPoll: () => Promise<void>;
  /** Polling interval in ms (default: 12000) */
  intervalMs?: number;
  /** Current realtime connection status */
  connectionStatus: ConnectionStatus;
  /** Whether the hook is enabled (default: true) */
  enabled?: boolean;
}

export function usePollingFallback({
  onPoll,
  intervalMs = 12_000,
  connectionStatus,
  enabled = true,
}: UsePollingFallbackOptions): void {
  const pollCallbackRef = useRef(onPoll);
  pollCallbackRef.current = onPoll;

  const isFetchingRef = useRef(false);

  // Derive whether we should poll — use ref to avoid re-triggering the interval
  const shouldPoll = enabled && connectionStatus !== "connected";

  useEffect(() => {
    if (!shouldPoll) return;

    console.log(
      `[usePollingFallback] ▶ Polling active (interval: ${intervalMs}ms)`
    );

    const doPoll = async () => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      try {
        await pollCallbackRef.current();
      } catch (err) {
        console.warn("[usePollingFallback] Poll failed:", err);
      } finally {
        isFetchingRef.current = false;
      }
    };

    // Do NOT poll immediately on activate — the visibility handler
    // already triggers a refetch. Just start the interval.
    const interval = setInterval(doPoll, intervalMs);

    return () => {
      clearInterval(interval);
      console.log("[usePollingFallback] ⏹ Polling stopped");
    };
  }, [shouldPoll, intervalMs]);
}
