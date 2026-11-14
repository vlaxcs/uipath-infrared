import type { ReactNode } from "react";
import type { Tone } from "~/ui/Badge";

const tones: Record<Exclude<Tone, "neutral" | "accent">, string> = {
  success: "bg-success-soft text-success border-success/30",
  warn: "bg-warn-soft text-warn border-warn/30",
  danger: "bg-danger-soft text-danger border-danger/30",
  info: "bg-info-soft text-info border-info/30",
};

export function Notice({ tone = "info", children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`type-body rounded-well border px-4 py-3 ${tones[tone]}`}>
      {children}
    </div>
  );
}
