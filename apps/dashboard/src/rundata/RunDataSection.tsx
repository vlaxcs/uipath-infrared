import type { ReactNode } from "react";
import { useId } from "react";
import { parseArtifact } from "~/runs/artifactParse";
import { latestOutputPath } from "~/runs/artifactRefs";
import type { RunSource } from "~/runs/source";
import type { RunSummary } from "~/runs/types";
import { useRunArtifact } from "~/runs/useRunArtifact";
import { useRuns } from "~/runs/useRuns";
import { useRunDetail } from "~/rundata/useRunDetail";

export type RunContract = "infra" | "result" | "rehearsal";

type RunDataSectionProps = {
  source: RunSource;
  runId: string | null;
  onPickRun: (runId: string) => void;
  contract: RunContract;
  noun: string;
  render: (document: unknown) => ReactNode;
};

export function RunDataSection({ source, runId, onPickRun, contract, noun, render }: RunDataSectionProps) {
  const runs = useRuns(source);
  const selected = runId ?? runs.runs[0]?.id ?? null;
  const summary = runs.runs.find((run) => run.id === selected) ?? null;
  const detail = useRunDetail(source, selected, summary?.updated_at ?? null);
  const path = detail.run ? latestOutputPath(detail.run, contract) : null;
  const artifact = useRunArtifact(source, detail.run ? selected : null, path);

  if (runs.loading && runs.runs.length === 0) return <Notice title="Loading runs" />;
  if (runs.error && runs.runs.length === 0) return <Notice title="The runs could not be loaded" body={runs.error} onRetry={runs.refresh} />;
  if (!selected) return <Notice title="No runs yet" body="Start a run from New run; its data shows here." />;

  return (
    <div className="flex flex-col gap-4">
      <RunPicker runs={runs.runs} selected={selected} onPickRun={onPickRun} />
      {detail.error ? (
        <Notice title={`${selected} could not be loaded`} body={detail.error} />
      ) : !detail.run ? (
        <Notice title={`Loading ${selected}`} />
      ) : !path ? (
        <Notice
          title={`${selected} has no ${noun} yet`}
          body={`The run is on ${detail.run.step}, ${detail.run.status.replace("_", " ")}.`}
        />
      ) : (
        <ArtifactBody path={path} noun={noun} artifact={artifact} render={render} />
      )}
    </div>
  );
}

function ArtifactBody({
  path, noun, artifact, render,
}: {
  path: string;
  noun: string;
  artifact: ReturnType<typeof useRunArtifact>;
  render: (document: unknown) => ReactNode;
}) {
  if (artifact.status === "error") return <Notice title={`${path} could not be loaded`} body={artifact.error} onRetry={artifact.retry} />;
  if (artifact.status === "unavailable") return <Notice title={`${path} is not in the run's directory`} />;
  if (artifact.status !== "ready" || artifact.text === undefined) return <Notice title={`Loading the ${noun}`} />;
  const parsed = parseArtifact(artifact.text);
  if (!parsed.ok) return <Notice title={`${path} could not be read`} body={parsed.error} />;
  return <>{render(parsed.value)}</>;
}

function RunPicker({ runs, selected, onPickRun }: { runs: RunSummary[]; selected: string; onPickRun: (runId: string) => void }) {
  const id = useId();
  const listed = runs.some((run) => run.id === selected) ? runs : [{ id: selected } as RunSummary, ...runs];
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface p-4">
      <label htmlFor={id} className="text-label text-fg-muted">Run</label>
      <select
        id={id}
        value={selected}
        onChange={(event) => onPickRun(event.target.value)}
        className="rounded-control border border-border bg-surface px-3 py-2 text-label text-fg"
      >
        {listed.map((run) => (
          <option key={run.id} value={run.id}>
            {run.status ? `${run.id} · ${run.status.replace("_", " ")}` : run.id}
          </option>
        ))}
      </select>
    </div>
  );
}

function Notice({ title, body, onRetry }: { title: string; body?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-card border border-dashed border-border-strong p-6" role="status">
      <p className="text-label font-medium">{title}</p>
      {body ? <p className="text-body text-fg-muted">{body}</p> : null}
      {onRetry ? (
        <button type="button" onClick={onRetry} className="rounded-control border border-border px-3 py-2 text-label hover:bg-surface-muted">
          Retry
        </button>
      ) : null}
    </div>
  );
}
