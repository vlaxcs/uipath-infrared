import type { ReactNode } from "react";

export interface CardProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  tone?: "default" | "danger";
  children?: ReactNode;
}

export function Card({ title, description, actions, tone = "default", children }: CardProps) {
  const border = tone === "danger" ? "border-danger/40" : "border-line";
  return (
    <section className={`rounded-card border ${border} bg-surface p-5 shadow-lip sm:p-6`}>
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="type-heading">{title}</h2>}
            {description && <p className="type-body mt-1 text-fg-muted">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
