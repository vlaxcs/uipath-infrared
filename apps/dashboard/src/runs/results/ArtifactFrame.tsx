import type { ReactNode } from "react";
import type { ArtifactFeed } from "~/runs/useRunArtifact";
import { parseArtifact } from "~/runs/artifactParse";
import { RawArtifact } from "~/runs/results/RawArtifact";

type ArtifactFrameProps = {
  path: string;
  artifact: ArtifactFeed;
  children: (value: unknown) => ReactNode;
};

export function ArtifactFrame({ path, artifact, children }: ArtifactFrameProps) {
  if (artifact.status === "loading") {
    return <p className="text-body text-fg-muted">Loading {path}…</p>;
  }

  if (artifact.status === "unavailable") {
    return (
      <div className="flex flex-col gap-2 rounded-card border border-dashed border-border-strong p-4">
        <p className="text-label font-medium">Not written yet</p>
        <p className="text-body text-fg-muted">
          This step has not produced its file. It appears here once the step has run.
        </p>
        <p className="break-all font-mono text-caption text-fg-subtle">{path}</p>
      </div>
    );
  }

  if (artifact.status === "error") {
    return (
      <div role="alert" className="flex flex-col gap-2 rounded-control border border-status-failed p-3">
        <p className="text-label text-status-failed">{artifact.error}</p>
        <button
          type="button"
          onClick={artifact.retry}
          className="self-start rounded-control border border-border px-3 py-2 text-label hover:bg-surface-muted"
        >
          Retry
        </button>
      </div>
    );
  }

  if (artifact.status !== "ready" || artifact.text === undefined) {
    return <p className="text-body text-fg-muted">Waiting for {path}.</p>;
  }

  const parsed = parseArtifact(artifact.text);
  if (!parsed.ok) {
    return (
      <div role="alert" className="flex flex-col gap-2">
        <p className="text-label text-status-failed">The artifact is not valid JSON: {parsed.error}</p>
        <RawArtifact text={artifact.text} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {children(parsed.value)}
      <RawArtifact text={artifact.text} />
    </div>
  );
}
