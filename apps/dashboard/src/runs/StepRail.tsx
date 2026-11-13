import { RUN_STEPS } from "~/runs/stepProgress";
import type { RunDetail, RunStep, StepState } from "~/runs/types";
import { stepStateMeta } from "~/runs/status";
import { StatusBadge } from "~/ui/StatusBadge";

type StepRailProps = {
  run: RunDetail;
  states: Record<RunStep, StepState>;
};

export function StepRail({ run, states }: StepRailProps) {
  return (
    <section aria-labelledby="steps-title" className="flex flex-col gap-3">
      <h2 id="steps-title" className="text-label font-semibold uppercase tracking-wide text-fg-subtle">
        Steps
      </h2>
      <ol aria-label="Steps" className="flex flex-wrap gap-2">
        {RUN_STEPS.map((step) => {
          const meta = stepStateMeta[states[step]];
          const current = run.step === step;

          return (
            <li
              key={step}
              aria-current={current ? "step" : undefined}
              className={
                current
                  ? "flex flex-col gap-1 rounded-card border border-border-strong bg-surface px-3 py-2"
                  : "flex flex-col gap-1 rounded-card border border-border bg-surface px-3 py-2"
              }
            >
              <span className="text-label font-medium capitalize">{step}</span>
              <StatusBadge label={meta.label} tone={meta.tone} />
            </li>
          );
        })}
      </ol>
    </section>
  );
}
