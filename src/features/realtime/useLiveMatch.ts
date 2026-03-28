/**
 * useLiveMatch — Production-grade centralized data hook.
 *
 * Provides a single, resilient pipeline for ALL live match data across
 * Cricket, Football, and Badminton. Features:
 *
 *  ✅ Auto-reconnecting realtime via RealtimeManager
 *  ✅ Tab visibility refresh (useVisibilityRefresh)
 *  ✅ Polling fallback when realtime is unhealthy
 *  ✅ Race condition prevention (ref lock + request ID)
 *  ✅ Exponential backoff retries on fetch failure
 *  ✅ Debounced realtime-triggered refetches
 *  ✅ Custom fetcher support for complex consumers (e.g. Cricket)
 *  ✅ Connection status exposure for UI indicators
 *  ✅ Last-known-state preservation (never blank the UI)
 *  ✅ Stable callback references (no infinite render loops)
 */
"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { getMatchDetails, getMatchState } from "@/features/scoring/api";
import { RealtimeManager, type ConnectionStatus } from "@/lib/realtime/RealtimeManager";
import { useVisibilityRefresh } from "@/lib/realtime/useVisibilityRefresh";
import { usePollingFallback } from "@/lib/realtime/usePollingFallback";

// ── Types ──────────────────────────────────────────────────────────

interface UseLiveMatchOptions<T> {
  matchId: string;
  initialState: T;
  /**
   * Optional custom fetcher. When provided, the hook will call this
   * instead of the default getMatchState() to load data. This allows
   * complex consumers (like Cricket) to load relational data (innings,
   * batting/bowling stats) while still using this centralized resilience layer.
   *
   * The fetcher should handle its own state updates internally.
   * Return `true` if data was loaded successfully, `false` otherwise.
   */
  fetcher?: () => Promise<boolean>;
  /**
   * Optional callback that runs after any successful data load.
   */
  onDataLoaded?: () => void;
}

interface UseLiveMatchReturn<T> {
  state: T;
  match: any;
  teamAName: string;
  teamBName: string;
  loading: boolean;
  error: string | null;
  connectionStatus: ConnectionStatus;
  lastUpdated: number | null;
  refetch: () => Promise<void>;
}

// ── Constants ──────────────────────────────────────────────────────

const RETRY_DELAYS = [1000, 2000, 4000]; // exponential backoff
const DEBOUNCE_MS = 100; // Fast propagation for live scoring
const FETCH_TIMEOUT_MS = 8000;

// ── Hook ───────────────────────────────────────────────────────────

export function useLiveMatch<T>({
  matchId,
  initialState,
  fetcher,
  onDataLoaded,
}: UseLiveMatchOptions<T>): UseLiveMatchReturn<T> {
  const [state, setState] = useState<T>(initialState);
  const [match, setMatch] = useState<any>(null);
  const [teamAName, setTeamAName] = useState("TEAM A");
  const [teamBName, setTeamBName] = useState("TEAM B");
  const [loading, setLoading] = useState(true);
  const loadingRef = useRef(true); // Mirror for stale closure safety
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  // ── Refs for stable identity across renders ──
  // CRITICAL: Using refs for callbacks prevents them from causing
  // useEffect re-runs and breaking the subscription lifecycle.
  const fetchLockRef = useRef(false);
  const requestIdRef = useRef(0);
  const managerRef = useRef<RealtimeManager | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const matchRef = useRef<any>(null); // track match without causing re-renders in fetchData
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const onDataLoadedRef = useRef(onDataLoaded);
  onDataLoadedRef.current = onDataLoaded;
  const connectionStatusRef = useRef<ConnectionStatus>("disconnected");

  // Keep matchRef in sync
  useEffect(() => { matchRef.current = match; }, [match]);

  // ── Core fetch with retry ──
  // CRITICAL: This must have ZERO state variables in its dependency array.
  // It reads state exclusively through refs to prevent identity changes
  // that would cascade into subscription teardowns and infinite loops.
  const fetchData = useCallback(async (isInitial = false) => {
    if (!matchId || matchId === "undefined") return;

    // Race condition prevention: skip if another fetch is in flight
    if (fetchLockRef.current && !isInitial) {
      console.log("[useLiveMatch] Skipping fetch — lock held");
      return;
    }
    fetchLockRef.current = true;
    console.log(`[useLiveMatch] Fetching data (initial=${isInitial}) for ${matchId}`);

    const thisRequestId = ++requestIdRef.current;

    const attemptFetch = async (retryIndex: number): Promise<void> => {
      // Hard timeout to protect against dropped OS fetch requests
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out")), FETCH_TIMEOUT_MS)
      );

      try {
        if (fetcherRef.current) {
          const success = await Promise.race([fetcherRef.current(), timeoutPromise]);
          if (!mountedRef.current || thisRequestId !== requestIdRef.current) return;
          if (success) {
            console.log("[useLiveMatch] ✅ Custom fetcher succeeded");
            setError(null);
            setLastUpdated(Date.now());
            onDataLoadedRef.current?.();
          } else {
            console.warn("[useLiveMatch] Custom fetcher returned false");
          }
        } else {
          // Default fetch: load match details + JSONB state
          if (isInitial || !matchRef.current) {
            const m: any = await Promise.race([getMatchDetails(matchId), timeoutPromise]);
            if (!mountedRef.current || thisRequestId !== requestIdRef.current) return;
            if (!m) {
              setError("Match not found.");
              return;
            }
            setMatch(m);
            matchRef.current = m;
            if (m?.team_a?.name) setTeamAName(m.team_a.name);
            if (m?.team_b?.name) setTeamBName(m.team_b.name);
          }

          const lsState: any = await Promise.race([getMatchState(matchId), timeoutPromise]);
          if (!mountedRef.current || thisRequestId !== requestIdRef.current) return;
          if (lsState?.state) {
            setState(lsState.state as T);
          }

          setError(null);
          setLastUpdated(Date.now());
          onDataLoadedRef.current?.();
        }
      } catch (err: any) {
        if (!mountedRef.current || thisRequestId !== requestIdRef.current) return;

        // Retry with exponential backoff
        if (retryIndex < RETRY_DELAYS.length) {
          console.warn(
            `[useLiveMatch] Fetch failed (attempt ${retryIndex + 1}), retrying in ${RETRY_DELAYS[retryIndex]}ms...`,
            err?.message
          );
          await new Promise((r) => setTimeout(r, RETRY_DELAYS[retryIndex]));
          if (!mountedRef.current || thisRequestId !== requestIdRef.current) return;
          return attemptFetch(retryIndex + 1);
        }

        console.error("[useLiveMatch] All retries exhausted:", err);
        setError(err?.message ?? "Failed to load match data.");
      }
    };

    try {
      await attemptFetch(0);
    } finally {
      if (thisRequestId === requestIdRef.current) {
        fetchLockRef.current = false;
        if (mountedRef.current && isInitial) {
          console.log("[useLiveMatch] Initial fetch complete — clearing loading state");
          loadingRef.current = false;
          setLoading(false);
        }
      }
    }
  }, [matchId]); // ← ONLY matchId. No state variables.

  // Store fetchData in a ref so other hooks can call it without deps
  const fetchDataRef = useRef(fetchData);
  fetchDataRef.current = fetchData;

  // ── Debounced refetch (for realtime triggers) ──
  const debouncedRefetch = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      fetchDataRef.current(false);
    }, DEBOUNCE_MS);
  }, []); // ← Stable. Uses ref internally.

  // ── Manual refetch (exposed to consumers) ──
  const refetch = useCallback(async () => {
    await fetchDataRef.current(false);
  }, []); // ← Stable.

  // ── 1. Initial data load ──
  useEffect(() => {
    mountedRef.current = true;

    if (!matchId || matchId === "undefined") {
      setError("No match ID provided.");
      setLoading(false);
      return;
    }

    // Safety timeout: uses loadingRef (NOT loading state) to avoid
    // stale closure reading the initial `true` value forever.
    const safetyTimer = setTimeout(() => {
      if (mountedRef.current && loadingRef.current) {
        console.warn(`[useLiveMatch] Safety timeout for ${matchId}`);
        loadingRef.current = false;
        setLoading(false);
        setError("Loading took too long. Please refresh the page.");
      }
    }, 15_000);

    fetchDataRef.current(true);

    return () => {
      mountedRef.current = false;
      clearTimeout(safetyTimer);
    };
  }, [matchId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 2. Realtime subscription via RealtimeManager ──
  // CRITICAL: This effect must NOT depend on any callback or state that
  // changes after a fetch. Only matchId should cause a re-subscription.
  useEffect(() => {
    if (!matchId || matchId === "undefined") return;

    const manager = new RealtimeManager();
    managerRef.current = manager;

    manager.subscribe({
      key: `match_state:${matchId}`,
      table: "ls_match_state",
      filter: `match_id=eq.${matchId}`,
      onPayload: () => {
        // Always do a debounced refetch on any change.
        // Using ref to avoid dependency issues.
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
          fetchDataRef.current(false);
        }, DEBOUNCE_MS);
      },
      onStatusChange: (status) => {
        if (mountedRef.current) {
          connectionStatusRef.current = status;
          setConnectionStatus(status);
        }
      },
    });

    return () => {
      manager.cleanup();
      managerRef.current = null;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [matchId]); // ← ONLY matchId. Stable.

  // ── 3. Visibility refresh ──
  // When the user comes back to the tab, just do a simple refetch.
  // Do NOT tear down or recreate subscriptions here — that causes
  // cascading status changes and infinite loops.
  useVisibilityRefresh({
    onVisible: () => {
      fetchDataRef.current(false);
    },
    enabled: !!matchId,
  });

  // ── 4. Polling fallback ──
  // Only polls when realtime is unhealthy. Uses ref-based status
  // to avoid re-triggering effects.
  usePollingFallback({
    onPoll: () => fetchDataRef.current(false),
    connectionStatus,
    enabled: !!matchId,
  });

  // ── Memoized return ──
  return useMemo(
    () => ({
      state,
      match,
      teamAName,
      teamBName,
      loading,
      error,
      connectionStatus,
      lastUpdated,
      refetch,
    }),
    [state, match, teamAName, teamBName, loading, error, connectionStatus, lastUpdated, refetch]
  );
}
