import { Field } from "~/rehearsal/parts";
import type { VerdictView } from "~/rehearsal/verdict";
import { StatusBadge } from "~/ui/StatusBadge";

const BORDER: Record<string, string> = {
  completed: "border-status-completed",
  failed: "border-status-failed",
};

export function VerdictBanner({ verdict }: { verdict: VerdictView }) {
  return (
    <section
      aria-labelledby="verdict-title"
      className={`flex flex-col gap-3 rounded-card border bg-surface p-6 ${
        BORDER[verdict.tone] ?? "border-border"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3
          id="verdict-title"
          className="text-label font-semibold uppercase tracking-wide text-fg-subtle"
        >
          Verdict
        </h3>
        <StatusBadge label={verdict.label} tone={verdict.tone} />
      </div>

      <p className="text-body">{verdict.headline}</p>
      <p className="text-body text-fg-muted">{verdict.reason ?? "No reason recorded."}</p>

      <dl className="grid gap-3 sm:grid-cols-3">
        <Field label="Measured availability">{verdict.measured}</Field>
        <Field label="Forecast minimum">{verdict.threshold}</Field>
        <Field label="Gap">
          {verdict.gap}
          {verdict.gapDerived ? (
            <span className="text-caption text-fg-subtle">
              {" "}
              (derived from measured and threshold)
            </span>
          ) : null}
        </Field>
      </dl>

      <div className="flex flex-col gap-2 rounded-card border border-border bg-surface-muted p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-caption font-semibold uppercase tracking-wide text-fg-subtle">
            Next step
          </span>
          <StatusBadge label={verdict.decision.label} tone={verdict.decision.tone} />
        </div>
        <p className="text-caption text-fg-subtle">{verdict.decision.sourceLabel}</p>
        {verdict.decision.reason && verdict.decision.reason !== verdict.reason ? (
          <p className="text-body">{verdict.decision.reason}</p>
        ) : null}
        {verdict.decision.conflict ? (
          <p className="text-label text-status-failed">
            The recorded decision disagrees with the verdict.
          </p>
        ) : null}
      </div>
    </section>
  );
}
