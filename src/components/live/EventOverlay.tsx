"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";

interface EventOverlayProps {
  event: "four" | "six" | "wicket" | null;
}

export function EventOverlay({ event }: EventOverlayProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (event) {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [event]);

  if (!visible || !event) return null;

  const config = {
    four: { label: "FOUR!", emoji: "4️⃣", color: "text-primary" },
    six: { label: "SIX!", emoji: "6️⃣", color: "text-accent" },
    wicket: { label: "WICKET!", emoji: "🔴", color: "text-destructive" },
  };

  const { label, emoji, color } = config[event];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="text-center animate-slide-up">
        <div className="text-6xl mb-2">{emoji}</div>
        <div className={`text-4xl md:text-6xl font-black ${color}`}>
          {label}
        </div>
      </div>
    </div>
  );
}

