import type { CandidateView, Metric } from "~/candidates/model";
import { ChangeSteps } from "~/candidates/ChangeSteps";
import { ViolationList } from "~/candidates/ViolationList";
import { StatusBadge } from "~/ui/StatusBadge";

export function CandidateDetail({ candidate }: { candidate: CandidateView }) {
  return (
    <section
      aria-live="polite"
      aria-labelledby="candidate-detail-title"
      className="flex flex-col gap-4 rounded-card border border-border bg-surface p-6"
    >
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 id="candidate-detail-title" className="font-mono text-title font-semibold">
            {candidate.id}
          </h2>
          <span className="flex flex-wrap items-center gap-1.5">
            <StatusBadge label={candidate.statusLabel} tone={candidate.statusTone} />
            {candidate.sourceLabel ? <StatusBadge label={candidate.sourceLabel} tone="neutral" /> : null}
            {candidate.pareto ? <StatusBadge label="Pareto frontier" tone="neutral" /> : null}
            <StatusBadge label={candidate.confidence.label} tone={candidate.confidence.tone} />
          </span>
        </div>
        <p className="text-label text-fg-muted">
          {candidate.rankLabel}
          {candidate.buildsOn ? ` · builds on ${candidate.buildsOn}` : ""}
        </p>
      </div>

      {candidate.whyLost ? (
        <div className="flex flex-col gap-2 rounded-card border border-border-strong bg-surface-muted p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-caption font-semibold uppercase tracking-wide text-fg-subtle">
              Why it lost
            </span>
            <StatusBadge label={candidate.whyLost.label} tone={candidate.whyLost.tone} />
          </div>
          <p className="text-body">{candidate.whyLost.detail}</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        <h3 className="text-label font-semibold uppercase tracking-wide text-fg-subtle">
          Cost, availability, risk and effort
        </h3>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricItems metrics={candidate.headline} />
        </dl>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MetricItems metrics={candidate.secondary} />
        </dl>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-label font-semibold uppercase tracking-wide text-fg-subtle">
          Cost breakdown
        </h3>
        <dl className="grid gap-3 sm:grid-cols-2">
          <MetricItems metrics={candidate.costLines} />
        </dl>

        {candidate.securityRemediation.length > 0 ? (
          <div className="flex flex-col gap-2">
            <h4 className="text-label font-semibold uppercase tracking-wide text-fg-subtle">
              Security remediation
            </h4>
            <dl className="grid gap-3 sm:grid-cols-3">
              <MetricItems metrics={candidate.securityRemediation} />
            </dl>
            <p className="text-caption text-fg-subtle">Already included in the totals above.</p>
          </div>
        ) : null}

        {candidate.onpremPlatform.length > 0 ? (
          <div className="flex flex-col gap-2">
            <h4 className="text-label font-semibold uppercase tracking-wide text-fg-subtle">
              On-prem platform
            </h4>
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <MetricItems metrics={candidate.onpremPlatform} />
            </dl>
            <p className="text-caption text-fg-subtle">Already included in the totals above.</p>
          </div>
        ) : null}
      </div>

      {candidate.violations.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-label font-semibold uppercase tracking-wide text-fg-subtle">
            Hard constraints broken
          </h3>
          <ViolationList violations={candidate.violations} label="Candidate violations" />
        </div>
      ) : null}

      <div className="flex flex-col gap-1">
        {candidate.confidence.reason ? (
          <p className="text-caption text-fg-subtle">{candidate.confidence.reason}</p>
        ) : null}
        {candidate.flags.length > 0 ? (
          <p className="text-caption text-fg-subtle">Flags: {candidate.flags.join(" · ")}</p>
        ) : null}
      </div>

      {candidate.steps ? <ChangeSteps steps={candidate.steps} /> : null}
    </section>
  );
}

function MetricItems({ metrics }: { metrics: readonly Metric[] }) {
  return (
    <>
      {metrics.map((metric) => (
        <div key={metric.label} className="flex flex-col gap-0.5">
          <dt className="text-caption uppercase tracking-wide text-fg-subtle">{metric.label}</dt>
          <dd className="break-words text-label">{metric.value}</dd>
        </div>
      ))}
    </>
  );
}
