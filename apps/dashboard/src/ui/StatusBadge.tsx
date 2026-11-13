export type StatusTone = "running" | "awaiting" | "completed" | "failed" | "neutral" | "idle" | "orphan";

const TONE_CLASSES: Record<StatusTone, string> = {
  running: "border-status-running text-status-running",
  awaiting: "border-status-awaiting text-status-awaiting",
  completed: "border-status-completed text-status-completed",
  failed: "border-status-failed text-status-failed",
  neutral: "border-border-strong text-fg-muted",
  idle: "border-status-idle text-status-idle",
  orphan: "border-status-orphan text-status-orphan",
};

export function StatusBadge({ label, tone }: { label: string; tone: StatusTone }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-0.5 text-caption font-medium ${TONE_CLASSES[tone]}`}
    >
      <span className="h-1.5 w-1.5 rounded-pill bg-current" aria-hidden="true" />
      {label}
    </span>
  );
}
