/**
 * ConnectionStatusIndicator — Non-blocking UI indicator for realtime status.
 *
 * Shows a small pill at the bottom of the viewport when realtime is
 * reconnecting or disconnected. Auto-hides when connected.
 */
"use client";

import React from "react";
import type { ConnectionStatus } from "@/lib/realtime/RealtimeManager";

interface Props {
  status: ConnectionStatus;
}

export function ConnectionStatusIndicator({ status }: Props) {
  if (status === "connected" || status === "connecting") return null;

  const isReconnecting = status === "reconnecting";

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-full shadow-lg border animate-fade-in"
      style={{
        background: isReconnecting ? "var(--surface)" : "var(--danger)",
        borderColor: isReconnecting ? "var(--warning)" : "var(--danger)",
        color: isReconnecting ? "var(--warning)" : "white",
      }}
    >
      <div
        className={`w-2 h-2 rounded-full ${
          isReconnecting ? "bg-[var(--warning)] animate-pulse" : "bg-white"
        }`}
      />
      <span className="text-xs font-semibold uppercase tracking-wide">
        {isReconnecting ? "Reconnecting…" : "Disconnected"}
      </span>
    </div>
  );
}
