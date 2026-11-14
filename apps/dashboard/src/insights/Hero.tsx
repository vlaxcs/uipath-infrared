import { Boxes, FlaskConical, Hand, ScanSearch, Shapes, type LucideIcon } from "lucide-react";
import { euros, signedEuros } from "~/insights/format";
import { useTween } from "~/insights/motion";
import { deltaTone, type ProjectTone } from "~/insights/tones";
import type { Pulse } from "~/insights/types";

type HeroProps = {
  pulse: Pulse;
  focus: { label: string; tone: ProjectTone } | null;
  sample: boolean;
  stale: boolean;
};

const COUNTERS: { key: keyof Pulse; icon: LucideIcon; label: string }[] = [
  { key: "components", icon: Boxes, label: "resources" },
  { key: "findings", icon: ScanSearch, label: "findings" },
  { key: "candidates", icon: Shapes, label: "options" },
  { key: "rehearsals", icon: FlaskConical, label: "rehearsals" },
  { key: "calls", icon: Hand, label: "your calls" },
];

export function Hero({ pulse, focus, sample, stale }: HeroProps) {
  const shown = useTween(
    Object.fromEntries(Object.entries(pulse).map(([key, value]) => [key, value])) as Record<string, number>,
    900,
  );
  const delta = shown.monthlyDelta ?? 0;

  return (
    <header className="pointer-events-none relative z-10 flex flex-wrap items-end justify-between gap-6 px-2 pt-2 lg:px-8">
      <div>
        <p className="type-eyebrow flex items-center gap-2 text-fg-subtle">
          {focus ? (
            <>
              <span className={`h-2 w-2 rounded-pill ${focus.tone.bg}`} aria-hidden="true" />
              {focus.label}
            </>
          ) : (
            `${pulse.projects} use cases · ${pulse.runs} runs`
          )}
          {sample ? <span className="rounded-pill border border-border px-2 text-caption normal-case tracking-normal">sample</span> : null}
          {stale ? (
            <span className="rounded-pill border border-status-awaiting px-2 text-caption normal-case tracking-normal text-status-awaiting">
              not refreshed
            </span>
          ) : null}
        </p>
        {pulse.planned > 0 ? (
          <p className={`type-hero ${deltaTone(pulse.monthlyDelta)}`} aria-live="polite">
            {signedEuros(delta)}
            <span className="ml-2 align-baseline text-title font-semibold tracking-normal text-fg-subtle">/mo</span>
          </p>
        ) : (
          <p className="type-hero text-fg-muted" aria-live="polite">
            {euros(shown.spend ?? 0)}
            <span className="ml-2 align-baseline text-title font-semibold tracking-normal text-fg-subtle">/mo today, no plan yet</span>
          </p>
        )}
      </div>
      <dl className="flex flex-wrap gap-x-7 gap-y-3">
        {COUNTERS.map(({ key, icon: Icon, label }) => (
          <div key={key} className="flex flex-col items-start">
            <dt className="order-2 text-caption text-fg-subtle">{label}</dt>
            <dd className="order-1 flex items-center gap-1.5 type-heading tabular-nums text-fg">
              <Icon className="h-4 w-4 text-fg-subtle" aria-hidden="true" />
              {Math.round(shown[key] ?? 0)}
            </dd>
          </div>
        ))}
      </dl>
    </header>
  );
}
