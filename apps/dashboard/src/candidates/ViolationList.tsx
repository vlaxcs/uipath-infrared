import type { ViolationView } from "~/candidates/model";

export function ViolationList({ violations, label }: { violations: readonly ViolationView[]; label: string }) {
  if (violations.length === 0) return null;
  return (
    <ul aria-label={label} className="flex flex-col gap-2">
      {violations.map((violation) => (
        <li key={violation.id} className="flex flex-col gap-1 rounded-card border border-border bg-surface-muted p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-label font-medium">{violation.constraint}</span>
            <span className="font-mono text-caption text-fg-subtle">{violation.component}</span>
          </div>
          <p className="text-body text-fg-muted">{violation.detail}</p>
          <p className="text-caption text-fg-subtle">{violation.values}</p>
        </li>
      ))}
    </ul>
  );
}
