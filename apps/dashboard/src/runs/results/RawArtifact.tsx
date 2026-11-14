export function RawArtifact({ text }: { text: string }) {
  return (
    <details className="rounded-control border border-border p-3">
      <summary className="cursor-pointer text-label">Raw JSON</summary>
      <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-all text-caption font-mono text-fg-muted">
        {text}
      </pre>
    </details>
  );
}
