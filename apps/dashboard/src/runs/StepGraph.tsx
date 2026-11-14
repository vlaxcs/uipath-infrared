import { RUN_STEPS } from "~/runs/stepProgress";
import { STEP_META } from "~/runs/stepMeta";
import type { RunDetail, RunStep, StepState } from "~/runs/types";
import { gateMeta, stepStateMeta } from "~/runs/status";
import { StatusBadge } from "~/ui/StatusBadge";

type StepGraphProps = {
  run: RunDetail;
  states: Record<RunStep, StepState>;
  selectedStep: RunStep | null;
  onSelectStep: (step: RunStep) => void;
};

export function StepGraph({ run, states, selectedStep, onSelectStep }: StepGraphProps) {
  return (
    <section aria-labelledby="steps-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="steps-title" className="text-label font-semibold uppercase tracking-wide text-fg-subtle">
          Pipeline
        </h2>
        <p className="text-caption text-fg-subtle">
          Select a step to inspect it; select it again for the run overview.
        </p>
      </div>
      <ol aria-label="Steps" className="flex items-center overflow-x-auto pb-1">
        {RUN_STEPS.map((step, index) => {
          const meta = STEP_META[step];
          const state = stepStateMeta[states[step]];
          const executing = run.step === step;
          const selected = selectedStep === step;

          return (
            <li key={step} className="flex shrink-0 items-center">
              <button
                type="button"
                aria-pressed={selected}
                aria-current={executing ? "step" : undefined}
                onClick={() => onSelectStep(step)}
                className={
                  selected
                    ? "flex min-w-36 flex-col gap-1 rounded-card border border-accent bg-surface px-4 py-3 text-left"
                    : "flex min-w-36 flex-col gap-1 rounded-card border border-border bg-surface px-4 py-3 text-left hover:border-border-strong"
                }
              >
                <span className="text-label font-semibold">{meta.title}</span>
                <StatusBadge label={state.label} tone={state.tone} />
                <span className="text-caption text-fg-subtle">
                  {meta.gate ? `Needs approval · ${gateMeta[meta.gate].label}` : "Automatic"}
                </span>
              </button>
              {index < RUN_STEPS.length - 1 ? (
                <span aria-hidden="true" className="h-0.5 w-6 shrink-0 bg-border-strong" />
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
