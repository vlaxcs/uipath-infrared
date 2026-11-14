import { useId, useMemo, useState, type FormEvent } from "react";
import { parseArtifact } from "~/runs/artifactParse";
import type { RunSource } from "~/runs/source";
import { useRunArtifact } from "~/runs/useRunArtifact";
import {
  DEFAULT_TRAFFIC,
  PHASE_LIMITS,
  RATE_LIMITS,
  readTrafficPrompt,
  type TrafficProfile,
} from "~/sandbox/trafficPrompt";
import { useTrials, type Trial } from "~/sandbox/useTrials";
import { StatusBadge } from "~/ui/StatusBadge";

const FIELD = "flex flex-col gap-1";
const LABEL = "text-label font-medium text-fg";
const INPUT = "rounded-control border border-border bg-surface px-3 py-2 text-label text-fg";
const HINT = "text-caption text-fg-subtle";

type SandboxPanelProps = { source: RunSource; runId: string; layout: string; pollMs?: number };

export function SandboxPanel({ source, runId, layout, pollMs }: SandboxPanelProps) {
  const id = useId();
  const { trials, pending, starting, error, start } = useTrials(source, runId, pollMs);
  const [traffic, setTraffic] = useState<TrafficProfile>(DEFAULT_TRAFFIC);
  const [prompt, setPrompt] = useState("");
  const [reading, setReading] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const shown = selected ?? trials[0]?.file ?? null;
  const live = source.mode === "live";

  const applyPrompt = () => {
    const result = readTrafficPrompt(prompt, traffic);
    setTraffic(result.profile);
    setReading(result.unread ? "Nothing read. Name a rate (80 rps) or a phase length (30 s)." : `Read: ${result.understood.join(", ")}.`);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSelected(null);
    void start(traffic);
  };

  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-4 rounded-control border border-border bg-surface p-4">
      <header className="flex flex-col gap-1">
        <h2 id={`${id}-title`} className="text-label font-semibold uppercase tracking-wide text-fg-subtle">
          Sandbox
        </h2>
        <p className={HINT}>
          Trial rehearsal of <span className="font-mono text-fg">{layout}</span>. Does not change the run or its gates.
        </p>
      </header>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className={FIELD}>
            <label htmlFor={`${id}-rate`} className={LABEL}>Requests per second</label>
            <input
              id={`${id}-rate`}
              type="number"
              min={RATE_LIMITS.min}
              max={RATE_LIMITS.max}
              step={1}
              required
              value={traffic.requests_per_second}
              onChange={(event) => setTraffic({ ...traffic, requests_per_second: Number(event.target.value) })}
              className={INPUT}
            />
            <p className={HINT}>{RATE_LIMITS.min} to {RATE_LIMITS.max}.</p>
          </div>
          <div className={FIELD}>
            <label htmlFor={`${id}-phase`} className={LABEL}>Seconds per phase</label>
            <input
              id={`${id}-phase`}
              type="number"
              min={PHASE_LIMITS.min}
              max={PHASE_LIMITS.max}
              step={1}
              required
              value={traffic.phase_seconds}
              onChange={(event) => setTraffic({ ...traffic, phase_seconds: Number(event.target.value) })}
              className={INPUT}
            />
            <p className={HINT}>Baseline, failure and recovery each run this long.</p>
          </div>
        </div>

        <div className={FIELD}>
          <label htmlFor={`${id}-prompt`} className={LABEL}>Prompt</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id={`${id}-prompt`}
              type="text"
              value={prompt}
              placeholder="150 rps for 30 seconds"
              onChange={(event) => setPrompt(event.target.value)}
              className={`${INPUT} min-w-0 flex-1`}
            />
            <button
              type="button"
              onClick={applyPrompt}
              disabled={prompt.trim() === ""}
              className="rounded-control border border-border px-4 py-2 text-label font-medium text-fg disabled:opacity-50"
            >
              Fill fields
            </button>
          </div>
          <p className={HINT} aria-live="polite">
            {reading ?? "Read in the browser. Only the two numbers are sent."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!live || starting || pending !== null}
            aria-busy={starting}
            className="rounded-control bg-accent px-4 py-2 text-label font-medium text-on-accent disabled:opacity-50"
          >
            {pending ? "Trial running" : "Run trial"}
          </button>
          {!live ? <p className={HINT}>Trials need a live orchestrator.</p> : null}
          {pending ? <p className={HINT} aria-live="polite">Waiting for <span className="font-mono">{pending}</span>.</p> : null}
        </div>
        {error ? (
          <p role="alert" className="text-label text-status-failed">
            {error}
          </p>
        ) : null}
      </form>

      {trials.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
          <ul aria-label="Trials" className="flex flex-col gap-1">
            {trials.map((trial) => (
              <li key={trial.file}>
                <button
                  type="button"
                  aria-pressed={trial.file === shown}
                  onClick={() => setSelected(trial.file)}
                  className="w-full rounded-control px-3 py-2 text-left text-label text-fg aria-pressed:bg-surface-muted"
                >
                  {trialLabel(trial)}
                </button>
              </li>
            ))}
          </ul>
          {shown ? <TrialVerdict source={source} runId={runId} file={shown} /> : null}
        </div>
      ) : (
        <p className={HINT}>No trials yet.</p>
      )}
    </section>
  );
}

function trialLabel(trial: Trial): string {
  return `Trial ${trial.number} · revision ${trial.revision}`;
}

type TrialDocument = {
  candidate_id?: string;
  traffic_profile?: { requests_per_second?: number };
  verdict?: { passed?: boolean; measured_availability_pct?: number; forecast_min_availability_pct?: number; reason?: string };
};

function TrialVerdict({ source, runId, file }: { source: RunSource; runId: string; file: string }) {
  const artifact = useRunArtifact(source, runId, file);
  const document = useMemo(() => {
    if (artifact.status !== "ready" || artifact.text === undefined) return null;
    const parsed = parseArtifact(artifact.text);
    return parsed.ok && typeof parsed.value === "object" && parsed.value !== null ? (parsed.value as TrialDocument) : null;
  }, [artifact.status, artifact.text]);

  if (artifact.status === "error") return <p role="alert" className="text-label text-status-failed">Could not read {file}.</p>;
  if (!document) return <p className={HINT}>Reading {file}.</p>;
  const verdict = document.verdict;
  if (!verdict || typeof verdict.passed !== "boolean") return <p className={HINT}>{file} has no verdict.</p>;

  return (
    <dl aria-label={`Verdict of ${file}`} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-label">
      <dt className="text-fg-subtle">Verdict</dt>
      <dd><StatusBadge label={verdict.passed ? "Passed" : "Failed"} tone={verdict.passed ? "completed" : "failed"} /></dd>
      <dt className="text-fg-subtle">Rate</dt>
      <dd className="font-mono text-fg">{document.traffic_profile?.requests_per_second ?? "?"} requests/s</dd>
      <dt className="text-fg-subtle">Availability</dt>
      <dd className="font-mono text-fg">
        {percent(verdict.measured_availability_pct)} measured, {percent(verdict.forecast_min_availability_pct)} required
      </dd>
      {verdict.reason ? (
        <>
          <dt className="text-fg-subtle">Reason</dt>
          <dd className="text-fg">{verdict.reason}</dd>
        </>
      ) : null}
    </dl>
  );
}

function percent(value: number | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(2)}%` : "?";
}
