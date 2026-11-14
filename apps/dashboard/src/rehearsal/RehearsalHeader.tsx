import type { ContextView } from "~/rehearsal/model";
import { Field } from "~/rehearsal/parts";
import { StatusBadge } from "~/ui/StatusBadge";

export function RehearsalHeader({ context }: { context: ContextView }) {
  return (
    <header className="flex flex-col gap-2">
      <h2 className="font-mono text-title font-semibold">{context.candidateId}</h2>
      <p className="text-label text-fg-muted">forecast {context.forecastId}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge
          label={`Schema ${context.schemaVersion}`}
          tone={context.schemaSupported ? "neutral" : "failed"}
        />
        <StatusBadge label={context.provenance} tone="neutral" />
      </div>
      {!context.schemaSupported ? (
        <p className="text-caption text-fg-muted">
          This rehearsal uses a schema this view does not know; showing it best-effort.
        </p>
      ) : null}
      <dl className="grid gap-3 sm:grid-cols-3">
        <Field label="Started">{context.startedAt}</Field>
        <Field label="Completed">{context.completedAt}</Field>
        <Field label="Elapsed">
          {context.elapsed ?? "Not stated"}
          {context.elapsedDerived ? (
            <span className="text-caption text-fg-subtle"> (derived from the timestamps)</span>
          ) : null}
        </Field>
      </dl>
    </header>
  );
}
