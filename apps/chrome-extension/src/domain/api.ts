import { emptyCost, runCostFromResult, type RunCost } from "~/domain/costs";
import { latestArtifactPaths, pickedLayout } from "~/domain/facts";
import { runnerReport } from "~/domain/runnerSuggestions";
import { deriveStepStates } from "~/domain/steps";
import type { LatestRun, RunDetail, RunSummary } from "~/domain/types";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class OrchestratorError extends Error {
  status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = "OrchestratorError";
    this.status = status;
  }
}

export class NoRunsError extends OrchestratorError {
  constructor() {
    super("No runs yet");
    this.name = "NoRunsError";
  }
}

export async function loadLatest(baseUrl: string, fetchImpl: FetchLike = fetch): Promise<LatestRun> {
  const base = baseUrl.replace(/\/+$/, "");
  const summaries = await getJson<RunSummary[]>(fetchImpl, `${base}/runs?limit=1`);
  const summary = summaries[0];
  if (!summary) throw new NoRunsError();

  const detail = await getJson<RunDetail>(
    fetchImpl,
    `${base}/runs/${encodeURIComponent(summary.id)}`,
  );
  const paths = latestArtifactPaths(detail.events);
  const [resultValue, infraValue] = await Promise.all([
    readJson(fetchImpl, fileUrl(base, summary.id, paths.result ?? `result.${detail.revision}.json`)),
    readJson(fetchImpl, fileUrl(base, summary.id, paths.infra ?? "infra.json")),
  ]);

  const cost: RunCost = resultValue === null ? emptyCost() : runCostFromResult(resultValue);
  const ciRunners = isRecord(infraValue) ? infraValue.ci_runners : undefined;
  const runners = runnerReport(ciRunners);

  return {
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
  };
}

function fileUrl(base: string, id: string, path: string): string {
  return `${base}/runs/${encodeURIComponent(id)}/files/${encodeURIComponent(path)}`;
}

async function getJson<T>(fetchImpl: FetchLike, url: string): Promise<T> {
  const response = await fetchImpl(url);
  if (!response.ok) throw await errorFrom(response);
  return (await response.json()) as T;
}

async function readJson(fetchImpl: FetchLike, url: string): Promise<unknown | null> {
  const response = await fetchImpl(url);
  if (response.status === 404) return null;
  if (!response.ok) throw await errorFrom(response);
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

async function errorFrom(response: Response): Promise<OrchestratorError> {
  let message = `HTTP ${response.status}`;
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === "string") message = body.error;
  } catch {
    // Keep the HTTP status message.
  }
  return new OrchestratorError(message, response.status);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
