import type { StatusTone } from "~/domain/status";

export function StatusBadge({ label, tone }: { label: string; tone: StatusTone }) {
  return (
    <span className={`ir-badge ir-badge-${tone}`}>
      <span className="ir-badge-dot" aria-hidden="true" />
      {label}
    </span>
  );
}
