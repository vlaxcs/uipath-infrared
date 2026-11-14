import runExample from "../../../../contracts/run.example.json";
import resultExample from "../../../../contracts/result.example.json";
import { runCostFromResult } from "~/domain/costs";
import { pickedLayout } from "~/domain/facts";
import { runnerReport } from "~/domain/runnerSuggestions";
import { deriveStepStates } from "~/domain/steps";
import type { LatestRun, RunDetail } from "~/domain/types";

const sampleCiRunners = {
  source_repo: "vlaxcs/uipath-infrared",
  runners: [
    {
      runner_type: "self-hosted",
      hours_month: 3,
      workflow_runs: 8,
      provenance: "estimated",
    },
    {
      runner_type: "ubuntu-latest",
      hours_month: 240,
      workflow_runs: 120,
      provenance: "estimated",
    },
  ],
};

export function sampleLatestRun(): LatestRun {
  const detail = runExample as unknown as RunDetail;
  const cost = runCostFromResult(resultExample);
  const runners = runnerReport(sampleCiRunners);

  return {
    source: "sample",
    id: detail.id,
    project: detail.project,
    status: detail.status,
    step: detail.step,
    revision: detail.revision,
    maxRevisions: detail.max_revisions,
    awaiting: detail.awaiting,
    updatedAt: detail.updated_at,
    before: cost.before,
    after: cost.after,
    winner: cost.winner,
    pickedLayout: pickedLayout(detail.events) ?? undefined,
    steps: deriveStepStates(detail),
    runners: runners.suggestions,
    runnerSourceRepo: runners.sourceRepo ?? undefined,
    runnerNote: runners.note,
    note: "The orchestrator did not answer; showing sample data.",
  };
}
