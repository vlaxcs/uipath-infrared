import { stepLabel, stepStateMeta } from "~/domain/status";
import type { StepEntry } from "~/domain/types";

export function PipelineStrip({ steps }: { steps: StepEntry[] }) {
  return (
    <ol className="ir-pipeline" aria-label="Pipeline">
      {steps.map(({ step, state }, index) => {
        const meta = stepStateMeta[state];
        return (
          <li key={step} className="ir-pipeline-step">
            <span
              className={`ir-pipeline-node ir-node-${state}`}
              title={`${stepLabel(step)}: ${meta.label}`}
              aria-label={`${stepLabel(step)}: ${meta.label}`}
            />
            {index < steps.length - 1 ? <span className="ir-pipeline-line" aria-hidden="true" /> : null}
          </li>
        );
      })}
    </ol>
  );
}
