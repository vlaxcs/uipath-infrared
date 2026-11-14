import type { ReactNode } from "react";
import type { CandidatesModel } from "~/candidates/model";
import { ViolationList } from "~/candidates/ViolationList";
import { StatusBadge } from "~/ui/StatusBadge";

export function BaselineSummary({ baseline }: { baseline: CandidatesModel["baseline"] }) {
  return (
    <section
      aria-labelledby="baseline-title"
      className="flex flex-col gap-3 rounded-card border border-border bg-surface p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3
          id="baseline-title"
          className="text-label font-semibold uppercase tracking-wide text-fg-subtle"
        >
          Today's estate
        </h3>
        {baseline.confidence ? (
          <StatusBadge label={baseline.confidence.label} tone={baseline.confidence.tone} />
        ) : null}
      </div>

      <dl className="grid gap-3 sm:grid-cols-3">
        <Field label="Cost">{baseline.monthly}</Field>
        <Field label="Availability">{baseline.availability}</Field>
        <Field label="Hard constraints">{`${baseline.violationCount} broken`}</Field>
      </dl>

      {baseline.confidence?.reason ? (
        <p className="text-caption text-fg-subtle">{baseline.confidence.reason}</p>
      ) : null}

      {baseline.violations.length > 0 ? (
        <details className="rounded-control border border-border p-3">
          <summary className="cursor-pointer text-label font-medium">
            Show the {baseline.violationCount} violations
          </summary>
          <div className="mt-3">
            <ViolationList violations={baseline.violations} label="Baseline violations" />
          </div>
        </details>
      ) : null}

      {baseline.flags.length > 0 ? (
        <p className="text-caption text-fg-subtle">Flags: {baseline.flags.join(" · ")}</p>
      ) : null}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-caption uppercase tracking-wide text-fg-subtle">{label}</dt>
      <dd className="text-label">{children}</dd>
    </div>
  );
}
