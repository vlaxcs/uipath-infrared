import { GitFork } from "lucide-react";
import type { ParallelTask, ParallelTaskState } from "~/runs/parallelTasks";
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
  parallel?: readonly ParallelTask[];
};

const PARALLEL_META: Record<ParallelTaskState, { label: string; tone: "running" | "completed" | "failed" }> = {
  running: { label: "Building", tone: "running" },
  done: { label: "Built", tone: "completed" },
  failed: { label: "Not built", tone: "failed" },
};

export function StepGraph({ run, states, selectedStep, onSelectStep, parallel = [] }: StepGraphProps) {
  return (
    <section aria-labelledby="steps-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="steps-title" className="text-label font-semibold uppercase tracking-wide text-fg-subtle">
          Pipeline
        </h2>
        <p className="text-caption text-fg-subtle">Select a step to inspect it.</p>
      </div>
      <ol aria-label="Steps" className="flex flex-col">
        {RUN_STEPS.map((step, index) => {
          const meta = STEP_META[step];
          const state = stepStateMeta[states[step]];
          const executing = run.step === step;
          const selected = selectedStep === step;
          const beside = parallel.filter((task) => task.beside === step);

          return (
            <li key={step} className="flex flex-col items-stretch">
              <button
                type="button"
                aria-pressed={selected}
                aria-current={executing ? "step" : undefined}
                onClick={() => onSelectStep(step)}
                className={
                  selected
                    ? "flex w-full flex-col gap-1 rounded-card border border-accent bg-surface px-4 py-3 text-left"
                    : "flex w-full flex-col gap-1 rounded-card border border-border bg-surface px-4 py-3 text-left hover:border-border-strong"
                }
              >
                <span className="text-label font-semibold">{meta.title}</span>
                <StatusBadge label={state.label} tone={state.tone} />
                <span className="text-caption text-fg-subtle">
                  {meta.gate ? `Needs approval · ${gateMeta[meta.gate].label}` : "Automatic"}
                </span>
              </button>
              {beside.length > 0 ? (
                <ul aria-label={`In parallel with ${meta.title}`} className="ml-6 flex flex-col gap-2 border-l-2 border-border-strong pl-4 pt-2">
                  {beside.map((task) => (
                    <li key={task.id} className="flex flex-wrap items-center gap-2 rounded-card border border-dashed border-border bg-surface px-3 py-2">
                      <GitFork aria-hidden="true" className="h-4 w-4 text-fg-subtle" />
                      <span className="min-w-0 break-all font-mono text-caption text-fg">{task.label}</span>
                      <StatusBadge label={PARALLEL_META[task.state].label} tone={PARALLEL_META[task.state].tone} />
                    </li>
                  ))}
                </ul>
              ) : null}
              {index < RUN_STEPS.length - 1 ? (
                <span aria-hidden="true" className="ml-6 h-4 w-0.5 bg-border-strong" />
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
