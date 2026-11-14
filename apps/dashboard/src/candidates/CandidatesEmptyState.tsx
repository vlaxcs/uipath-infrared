export function CandidatesEmptyState() {
  return (
    <div className="rounded-card border border-dashed border-border-strong p-6">
      <p className="text-label font-medium">No candidates</p>
      <p className="text-body text-fg-muted">This result has no candidates to show.</p>
    </div>
  );
}
