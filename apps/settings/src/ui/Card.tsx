import type { ReactNode } from "react";

export interface CardProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  tone?: "default" | "danger";
  dense?: boolean;
  children?: ReactNode;
}

export function Card({ title, description, actions, tone = "default", dense = false, children }: CardProps) {
  const border = tone === "danger" ? "border-danger/40" : "border-line";
  const padding = dense ? "px-4 py-3.5" : "p-5 sm:p-6";
  return (
    <section className={`rounded-card border ${border} bg-surface ${padding}`}>
      {(title || actions) && (
        <header className={`flex flex-wrap justify-between gap-3 ${dense ? "mb-2.5 items-center" : "mb-4 items-start"}`}>
          <div className="min-w-0">
            {title && <h2 className={dense ? "type-label" : "type-heading"}>{title}</h2>}
            {description && <p className={`mt-0.5 text-fg-muted ${dense ? "type-small" : "type-body"}`}>{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
