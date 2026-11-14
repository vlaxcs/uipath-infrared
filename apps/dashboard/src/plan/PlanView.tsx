import { useEffect, useMemo, useRef } from "react";
import "~/plan/estateView.css";
import "~/plan/rehearsalOverlay.css";
import "~/plan/providers.js";
import { mountEstateView } from "~/plan/estateView";
import { parseArtifact } from "~/runs/artifactParse";
import type { RunSource } from "~/runs/source";
import { useRunArtifact } from "~/runs/useRunArtifact";

type PlanViewProps = {
  source: RunSource;
  runId: string;
  revision: number;
  candidate: string;
  rehearsalPath: string | null;
};

export function PlanView({ source, runId, revision, candidate, rehearsalPath }: PlanViewProps) {
  const states = useRunArtifact(source, runId, `states.${revision}.${candidate}.json`);
  const rehearsal = useRunArtifact(source, runId, rehearsalPath);
  const container = useRef<HTMLDivElement>(null);

  const dataset = useMemo(() => {
    if (states.status !== "ready" || states.text === undefined) return null;
    const parsed = parseArtifact(states.text);
    if (!parsed.ok || typeof parsed.value !== "object" || parsed.value === null) return null;
    return (parsed.value as { dataset?: unknown }).dataset ?? null;
  }, [states.status, states.text]);

  const failedComponent = useMemo(() => {
    if (rehearsal.status !== "ready" || rehearsal.text === undefined) return undefined;
    const parsed = parseArtifact(rehearsal.text);
    if (!parsed.ok) return undefined;
    const document = parsed.value as { candidate_id?: string; failure?: { target_component?: string } };
    return document.candidate_id === candidate ? document.failure?.target_component : undefined;
  }, [rehearsal.status, rehearsal.text, candidate]);

  useEffect(() => {
    if (!container.current || !dataset) return;
    return mountEstateView(container.current, dataset, { failedComponent });
  }, [dataset, failedComponent]);

  return (
    <section aria-labelledby="plan-view-title" className="flex flex-col gap-3">
      <h3 id="plan-view-title" className="text-label font-semibold uppercase tracking-wide text-fg-subtle">
        Migration plan
      </h3>
      {states.status === "unavailable" ? (
        <p className="text-caption text-fg-muted">No plan built for {candidate}. Plans are built for the winner and for the picked layout.</p>
      ) : states.status === "error" ? (
        <p role="alert" className="text-caption text-status-failed">Plan unavailable: {states.error}</p>
      ) : states.status === "ready" && !dataset ? (
        <p role="alert" className="text-caption text-status-failed">The plan file is not a states document.</p>
      ) : states.status !== "ready" ? (
        <p className="text-caption text-fg-muted">Loading the plan…</p>
      ) : null}
      <div ref={container} data-plan-view={candidate} hidden={!dataset} />
    </section>
  );
}
