import { MetricField } from "~/rehearsal/parts";
import type { TimelineView } from "~/rehearsal/timeline";

export function PhaseTimeline({ timeline }: { timeline: TimelineView }) {
  return (
    <section aria-labelledby="phases-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="phases-title" className="text-title font-semibold">
          Before, during and after
        </h3>
        <p className="text-caption text-fg-subtle">
          {timeline.measuredPhases} of 3 phases measured
          {timeline.failureWindow ? ` · failure window ${timeline.failureWindow}` : ""}
        </p>
      </div>

      <ol aria-label="Rehearsal phases" className="grid gap-4 md:grid-cols-3">
        {timeline.phases.map((phase) => (
          <li
            key={phase.key}
            className="flex flex-col gap-3 rounded-card border border-border bg-surface p-6"
          >
            <div>
              <h4 className="text-label font-semibold">{phase.label}</h4>
              <p className="text-caption text-fg-subtle">
                {phase.window} · {phase.duration}
              </p>
            </div>
            <dl className="flex flex-col gap-3">
              <MetricField label="Availability" cell={phase.availability} />
              <MetricField label="Error rate" cell={phase.errorRate} />
              <MetricField label="Latency p50" cell={phase.latencyP50} />
              <MetricField label="Latency p95" cell={phase.latencyP95} />
              <MetricField label="Latency p99" cell={phase.latencyP99} />
              <MetricField
                label="Requests"
                cell={{
                  value: phase.requests,
                  measured: phase.requestsMeasured,
                  provenance: null,
                  basis: null,
                }}
              />
            </dl>
          </li>
        ))}
      </ol>
    </section>
  );
}
