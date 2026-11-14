import type { ReactNode } from "react";

export function PageHeader({ id, title, lead }: { id: string; title: string; lead?: string }) {
  return (
    <header className="flex flex-col gap-1">
      <h1 id={id} className="text-display font-semibold tracking-tight">{title}</h1>
      {lead ? <p className="text-body text-fg-muted">{lead}</p> : null}
    </header>
  );
}

export function PageSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-card border border-border bg-surface p-5">
      <h2 className="text-label font-semibold text-fg">{title}</h2>
      {children}
    </section>
  );
}

export function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <dt className="text-label text-fg-muted">{label}</dt>
      <dd className="text-label text-fg">{value}</dd>
    </div>
  );
}
