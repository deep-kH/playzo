import type { MatchStatus } from "@/lib/types/database";

const statusConfig: Record<
  MatchStatus,
  { label: string; className: string }
> = {
  live: { label: "LIVE", className: "badge-live" },
  scheduled: { label: "Scheduled", className: "badge-scheduled" },
  completed: { label: "Completed", className: "badge-completed" },
  cancelled: { label: "Cancelled", className: "badge-cancelled" },
};

interface StatusBadgeProps {
  status: MatchStatus | string;
  size?: "sm" | "md";
}

export function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  const config = statusConfig[status as MatchStatus] ?? {
    label: status,
    className: "badge-scheduled",
  };

  return (
    <span
      className={`${config.className} ${
        size === "md" ? "text-sm px-3 py-1" : ""
      }`}
    >
      {config.label}
    </span>
  );
}

