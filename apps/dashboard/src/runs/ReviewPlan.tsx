import { useEffect, useState } from "react";
import { PlanView } from "~/plan/PlanView";
import type { RunSource } from "~/runs/source";

type ReviewPlanProps = { source: RunSource; runId: string; revision: number; candidate: string };

/* Builds a candidate's migration plan on demand, then shows it, so each one can be reviewed before picking. */
export function ReviewPlan({ source, runId, revision, candidate }: ReviewPlanProps) {
  const [state, setState] = useState<{ status: "building" | "ready" | "failed"; error?: string }>(() =>
    source.buildPlan ? { status: "building" } : { status: "ready" },
  );

  useEffect(() => {
    const build = source.buildPlan;
    if (!build) return;
    const controller = new AbortController();
    setState({ status: "building" });
    build(runId, candidate, controller.signal).then(
      () => setState({ status: "ready" }),
      (error: unknown) => {
        if (!controller.signal.aborted) setState({ status: "failed", error: error instanceof Error ? error.message : String(error) });
      },
    );
    return () => controller.abort();
  }, [source, runId, candidate]);

  if (state.status === "building") {
    return (
      <p role="status" className="text-caption text-fg-muted">
        Building the migration plan of {candidate}…
      </p>
    );
  }
  if (state.status === "failed") {
    return (
      <p role="alert" className="text-caption text-status-failed">
        Plan unavailable: {state.error}
      </p>
    );
  }
  return <PlanView source={source} runId={runId} revision={revision} candidate={candidate} rehearsalPath={null} />;
}
