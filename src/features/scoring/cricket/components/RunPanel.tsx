"use client";

interface RunPanelProps {
  onRun: (runs: number) => void;
  disabled?: boolean;
}

export function RunPanel({ onRun, disabled }: RunPanelProps) {
  const buttons = [
    { value: 0, label: "0", size: "large" as const, color: "default" as const },
    { value: 1, label: "1", size: "large" as const, color: "default" as const },
    { value: 2, label: "2", size: "medium" as const, color: "default" as const },
    { value: 3, label: "3", size: "medium" as const, color: "default" as const },
    { value: 4, label: "4", size: "large" as const, color: "four" as const },
    { value: 5, label: "5", size: "small" as const, color: "default" as const },
    { value: 6, label: "6", size: "large" as const, color: "six" as const },
  ];

  const sizeClasses = {
    large: "min-h-[4rem] text-2xl font-bold",
    medium: "min-h-[3.5rem] text-xl font-bold",
    small: "min-h-[3rem] text-lg font-semibold",
  };

  const colorClasses = {
    default:
      "bg-surface border border-border-ui text-text hover:bg-surface-alt active:scale-95",
    four:
      "bg-primary/15 border-2 border-primary text-primary hover:bg-primary/25 active:scale-95",
    six:
      "bg-accent/15 border-2 border-accent text-accent hover:bg-accent/25 active:scale-95",
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-text-muted mb-2 uppercase tracking-wide">
        Runs
      </h3>
      <div className="grid grid-cols-4 gap-2">
        {buttons.map((btn) => (
          <button
            key={btn.value}
            onClick={() => onRun(btn.value)}
            disabled={disabled}
            className={`rounded-xl transition-all duration-100 ${
              sizeClasses[btn.size]
            } ${colorClasses[btn.color]} disabled:opacity-40`}
          >
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
}

