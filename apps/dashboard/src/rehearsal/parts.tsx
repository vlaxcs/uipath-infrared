import type { ReactNode } from "react";
import type { MetricCellView } from "~/rehearsal/metrics";

export function Card({
  id,
  title,
  description,
  aside,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="flex flex-col gap-3 rounded-card border border-border bg-surface p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3
          id={`${id}-title`}
          className="text-label font-semibold uppercase tracking-wide text-fg-subtle"
        >
          {title}
        </h3>
        {aside}
      </div>
      {description ? <p className="text-body text-fg-muted">{description}</p> : null}
      {children}
    </section>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-caption uppercase tracking-wide text-fg-subtle">{label}</dt>
      <dd className="break-words text-label">{children}</dd>
    </div>
  );
}

export function MetricValue({ cell }: { cell: MetricCellView }) {
  return (
    <span className="flex flex-col gap-0.5">
      <span className={cell.measured ? "text-label" : "text-label text-fg-subtle"}>
        {cell.value}
      </span>
      {cell.measured && (cell.provenance || cell.basis) ? (
        <span className="text-caption text-fg-subtle">
          {[cell.provenance, cell.basis].filter(Boolean).join(" · ")}
        </span>
      ) : null}
    </span>
  );
}

export function MetricField({ label, cell }: { label: string; cell: MetricCellView }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-caption uppercase tracking-wide text-fg-subtle">{label}</dt>
      <dd>
        <MetricValue cell={cell} />
      </dd>
    </div>
  );
}
