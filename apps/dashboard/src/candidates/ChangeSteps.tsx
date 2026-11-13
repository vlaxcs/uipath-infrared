import type { StepsModel } from "~/candidates/model";

export function ChangeSteps({ steps }: { steps: StepsModel }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-title font-semibold">The change, step by step</h3>
        <p className="text-label text-fg-muted">{steps.summary}</p>
      </div>
      <p className="text-caption text-fg-subtle">
        Each step builds on the previous one; the list includes the actions of the layers the candidate
        builds on.
      </p>

      {steps.groups.length === 0 ? (
        <p className="text-body text-fg-muted">This candidate changes nothing.</p>
      ) : (
        steps.groups.map((group) => (
          <div key={group.key} className="flex flex-col gap-2">
            <h4 className="text-label font-semibold uppercase tracking-wide text-fg-subtle">
              {group.label}
            </h4>
            <ol start={group.start} className="flex flex-col gap-2">
              {group.steps.map((step) => (
                <li
                  key={step.number}
                  className="flex flex-col gap-1 rounded-card border border-border bg-surface-muted p-3"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-label font-medium">
                      <span className="text-fg-subtle">Step {step.number}</span> ·{" "}
                      <span className="font-mono">{step.component}</span> · {step.action}
                    </p>
                    <span className={step.isNoOp ? "text-label text-fg-subtle" : "text-label"}>
                      {step.saving}
                    </span>
                  </div>
                  {step.fromTo ? <p className="text-caption text-fg-muted">{step.fromTo}</p> : null}
                  {step.reason ? <p className="text-body">{step.reason}</p> : null}
                  <p className="text-caption text-fg-subtle">
                    {[step.signal ? `Signal: ${step.signal}` : null, step.effort, step.confidence]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        ))
      )}
    </div>
  );
}
