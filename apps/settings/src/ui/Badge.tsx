import type { ReactNode } from "react";

export type Tone = "neutral" | "success" | "warn" | "danger" | "info" | "accent";

const tones: Record<Tone, string> = {
  neutral: "bg-sunken text-fg-muted border-line",
  success: "bg-success-soft text-success border-success/30",
  warn: "bg-warn-soft text-warn border-warn/30",
  danger: "bg-danger-soft text-danger border-danger/30",
  info: "bg-info-soft text-info border-info/30",
  accent: "bg-accent-soft text-accent border-accent/30",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`type-small inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-semibold ${tones[tone]}`}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}
