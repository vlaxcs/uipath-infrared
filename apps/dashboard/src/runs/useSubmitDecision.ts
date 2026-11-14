import { useCallback, useState } from "react";
import { RunSourceError, type RunSource } from "~/runs/source";
import type { HumanDecision, RunEvent } from "~/runs/types";

export type SubmitDecision = {
  submit: (decision: HumanDecision) => Promise<RunEvent | null>;
  busy: boolean;
  error: string | null;
  clearError: () => void;
};

export function useSubmitDecision(
  source: RunSource,
  runId: string | null,
  onConflict?: () => void,
): SubmitDecision {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (decision: HumanDecision): Promise<RunEvent | null> => {
      if (!runId) return null;
      setBusy(true);
      setError(null);
      try {
        return await source.submitDecision(runId, decision);
      } catch (cause) {
        if (cause instanceof RunSourceError) {
          if (cause.status === 409) {
            setError("This run has moved on (another surface may have decided). Refreshing.");
            onConflict?.();
          } else if (cause.status === 422) {
            setError("That layout is not feasible in the latest result. Refresh and pick another.");
          } else {
            setError(cause.message);
          }
        } else {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
        return null;
      } finally {
        setBusy(false);
      }
    },
    [source, runId, onConflict],
  );

  return { submit, busy, error, clearError: () => setError(null) };
}
