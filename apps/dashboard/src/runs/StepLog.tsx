import { useEffect, useRef } from "react";
import { STEP_META } from "~/runs/stepMeta";
import type { RunStep } from "~/runs/types";
import type { StepLogState } from "~/runs/useStepLog";

export function StepLog({ step, log }: { step: RunStep; log: StepLogState }) {
  const output = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (output.current) output.current.scrollTop = output.current.scrollHeight;
  }, [log.text]);

  return (
    <section aria-labelledby="step-log-title" className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="step-log-title" className="text-label font-semibold uppercase tracking-wide text-fg-subtle">
          Log · {STEP_META[step].title}
        </h2>
        {log.running ? <span className="text-caption text-status-running">live</span> : null}
      </div>
      {log.status === "not_started" ? (
        <p className="text-caption text-fg-muted">Not started.</p>
      ) : log.status === "error" ? (
        <p role="alert" className="text-caption text-status-failed">Log unavailable: {log.error}</p>
      ) : log.text === "" ? (
        <p className="text-caption text-fg-muted">{log.status === "loading" ? "Loading…" : "No output."}</p>
      ) : (
        <pre
          ref={output}
          aria-label={`${STEP_META[step].title} log`}
          className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-control border border-border bg-surface-muted p-3 font-mono text-caption text-fg"
        >
          {log.text}
        </pre>
      )}
    </section>
  );
}
