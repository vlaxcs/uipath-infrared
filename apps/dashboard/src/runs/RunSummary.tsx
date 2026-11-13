import type { ReactNode } from "react";
import type { Run } from "~/runs/types";
import { formatTimestamp } from "~/runs/format";
import { runStatusMeta } from "~/runs/status";
import { StatusBadge } from "~/runs/StatusBadge";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-caption uppercase tracking-wide text-fg-subtle">{label}</dt>
      <dd className="text-label">{children}</dd>
    </div>
  );
}

export function RunSummary({ run }: { run: Run }) {
  const status = runStatusMeta[run.status];
  const files = [run.inputs.forecast, run.inputs.catalog];

  return (
    <section aria-labelledby="run-summary-title" className="flex flex-col gap-6 rounded-card border border-border bg-surface p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="run-summary-title" className="text-title font-semibold">
            {run.project}
          </h2>
          <p className="font-mono text-caption text-fg-muted">{run.id}</p>
        </div>
        <StatusBadge label={status.label} tone={status.tone} />
      </div>

      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Step">
          <span className="capitalize">{run.step}</span>
        </Field>
        <Field label="Revision">
          {run.revision} / {run.max_revisions}
        </Field>
        <Field label="Started">{formatTimestamp(run.started_at)}</Field>
        <Field label="Updated">{formatTimestamp(run.updated_at)}</Field>
        <Field label="Finished">{run.finished_at ? formatTimestamp(run.finished_at) : "Not finished"}</Field>
      </dl>

      <div className="flex flex-col gap-3">
        <h3 className="text-label font-semibold">Inputs</h3>
        <ul className="flex flex-col gap-2">
          {files.map((file) => (
            <li key={file.path} className="flex flex-col gap-0.5 rounded-control bg-surface-muted px-3 py-2">
              <span className="text-label">{file.path}</span>
              <span className="break-all font-mono text-caption text-fg-subtle">{file.sha256.slice(0, 12)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
