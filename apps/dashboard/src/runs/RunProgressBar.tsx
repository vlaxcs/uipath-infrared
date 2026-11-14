import { STEP_META } from "~/runs/stepMeta";
import { RUN_STEPS } from "~/runs/stepProgress";
import type { RunSummary } from "~/runs/types";

export function isLive(run: RunSummary): boolean {
  return run.status === "running" || run.status === "awaiting_approval";
}

export function RunProgressBar({ run }: { run: RunSummary }) {
  const current = Math.max(0, RUN_STEPS.indexOf(run.step));
  const awaiting = run.status === "awaiting_approval";
  const title = STEP_META[run.step].title;
  const label = `Step ${current + 1} of ${RUN_STEPS.length}: ${title}${awaiting ? ", awaiting approval" : ""}`;

  return (
    <div className="flex flex-col gap-1">
      <div
        role="progressbar"
        aria-label={`${run.id} progress`}
        aria-valuemin={1}
        aria-valuemax={RUN_STEPS.length}
        aria-valuenow={current + 1}
        aria-valuetext={label}
        className="grid grid-cols-6 gap-1"
      >
        {RUN_STEPS.map((step, index) => (
          <span
            key={step}
            data-step-state={index < current ? "done" : index === current ? (awaiting ? "awaiting" : "current") : "pending"}
            className={
              index < current
                ? "h-1.5 rounded-pill bg-status-completed"
                : index === current
                  ? awaiting
                    ? "h-1.5 rounded-pill bg-status-awaiting"
                    : "h-1.5 animate-pulse rounded-pill bg-credit"
                  : "h-1.5 rounded-pill bg-border"
            }
          />
        ))}
      </div>
      <span className="text-caption text-fg-subtle">{label}</span>
    </div>
  );
}
