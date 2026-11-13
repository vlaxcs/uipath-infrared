export function RunsEmptyState({ hasRuns }: { hasRuns: boolean }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-card border border-dashed border-border-strong p-6">
      <p className="text-label font-medium">{hasRuns ? "Select a run" : "No runs yet"}</p>
      <p className="text-body text-fg-muted">
        {hasRuns ? "Pick a run from the list to see its summary." : "Runs started from the orchestrator will appear here."}
      </p>
    </div>
  );
}
