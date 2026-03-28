/**
 * useVisibilityRefresh — Tab focus/visibility handler.
 *
 * Triggers a callback when the user returns to the tab after it's been hidden.
 * Debounces to prevent rapid-fire refetches from quick alt-tabs.
 *
 * STABILITY: Only listens to `visibilitychange` (not `focus`).
 * Listening to both causes double-fires on every tab switch because
 * browsers emit both events together.
 */
"use client";

import { useEffect, useRef } from "react";

interface UseVisibilityRefreshOptions {
  /** Callback to execute when visibility is regained */
  onVisible: () => void;
  /** Debounce time in ms (default: 2000) */
  debounceMs?: number;
  /** Whether the hook is enabled (default: true) */
  enabled?: boolean;
}

export function useVisibilityRefresh({
  onVisible,
  debounceMs = 2000,
  enabled = true,
}: UseVisibilityRefreshOptions): void {
  const callbackRef = useRef(onVisible);
  callbackRef.current = onVisible;

  const lastTriggerRef = useRef(0);

  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;

    let staggerTimer: ReturnType<typeof setTimeout> | null = null;

    const handleVisibility = () => {
      if (document.visibilityState !== "visible") {
        if (staggerTimer) clearTimeout(staggerTimer);
        return;
      }

      const now = Date.now();
      if (now - lastTriggerRef.current < debounceMs) return;
      lastTriggerRef.current = now;

      console.log("[useVisibilityRefresh] Tab visible — staging refresh in 500ms");
      // 🚨 DELAYED EXECUTION STAGGER 🚨
      // Give the OS 500ms to re-establish network interfaces and the browser
      // to cleanly unthrottle the JS event loop before slamming Supabase.
      staggerTimer = setTimeout(() => {
        if (document.visibilityState === "visible") {
          callbackRef.current();
        }
      }, 500);
    };

    // ONLY listen to visibilitychange, NOT window.focus.
    // Both events fire simultaneously on tab switch; listening to both
    // causes double refetches and can cascade into render loops.
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (staggerTimer) clearTimeout(staggerTimer);
    };
  }, [debounceMs, enabled]);
}
