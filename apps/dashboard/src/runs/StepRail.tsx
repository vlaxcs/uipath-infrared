import { RUN_STEPS } from "~/runs/stepProgress";
import { STEP_META } from "~/runs/stepMeta";
import type { RunDetail, RunStep, StepState } from "~/runs/types";
import { stepStateMeta } from "~/runs/status";
import { StatusBadge } from "~/ui/StatusBadge";

type StepRailProps = {
  run: RunDetail;
  states: Record<RunStep, StepState>;
  selectedStep: RunStep;
  onSelectStep: (step: RunStep) => void;
};

export function StepRail({ run, states, selectedStep, onSelectStep }: StepRailProps) {
  return (
    <section aria-labelledby="steps-title" className="flex flex-col gap-3">
      <h2 id="steps-title" className="text-label font-semibold uppercase tracking-wide text-fg-subtle">
        Steps
      </h2>
      <ol aria-label="Steps" className="flex flex-col gap-2">
        {RUN_STEPS.map((step) => {
          const meta = stepStateMeta[states[step]];
          const stepInfo = STEP_META[step];
          const executing = run.step === step;
          const selected = selectedStep === step;

          return (
            <li key={step}>
              <button
                type="button"
                aria-pressed={selected}
                aria-current={executing ? "step" : undefined}
                onClick={() => onSelectStep(step)}
                className={
                  selected
                    ? "flex w-full flex-col gap-1 rounded-card border border-border-strong bg-surface px-3 py-2 text-left"
                    : "flex w-full flex-col gap-1 rounded-card border border-border bg-surface px-3 py-2 text-left hover:border-border-strong"
                }
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-label font-medium">{stepInfo.title}</span>
                  <StatusBadge label={meta.label} tone={meta.tone} />
                </span>
                <span className="text-caption text-fg-subtle">
                  {stepInfo.control === "approval" ? "Needs approval" : "Automatic"}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
