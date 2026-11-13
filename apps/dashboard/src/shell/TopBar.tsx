import type { ReactNode } from "react";

export function TopBar({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-border bg-surface px-6 py-4 lg:px-8">
      <h1 className="text-title font-semibold tracking-tight">{title}</h1>
      {children}
    </header>
  );
}
