export function RunsEmptyState() {
  return (
    <div className="flex flex-col items-start gap-2 rounded-card border border-dashed border-border-strong p-6">
      <p className="text-label font-medium">No runs yet</p>
      <p className="text-body text-fg-muted">Runs started from the orchestrator will appear here.</p>
    </div>
  );
}
