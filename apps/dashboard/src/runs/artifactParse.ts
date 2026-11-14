export type ParseResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string };

export function parseArtifact(text: string): ParseResult {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : String(cause) };
  }
}

export function artifactSummary(path: string, value: unknown): string {
  if (path === "infra.json" && isRecord(value) && Array.isArray(value.components)) {
    return `${value.components.length} components, ${Array.isArray(value.edges) ? value.edges.length : 0} dependencies`;
  }
  if (path === "findings.json" && isRecord(value) && Array.isArray(value.findings)) {
    return `${value.findings.length} findings`;
  }
  if (path.startsWith("candidates.") && isRecord(value) && Array.isArray(value.candidates)) {
    return `${value.candidates.length} candidates`;
  }
  if (path.startsWith("result.") && isRecord(value)) {
    const winner = typeof value.winner === "string" ? value.winner : null;
    const candidates = Array.isArray(value.candidates) ? `${value.candidates.length} candidates` : "";
    return winner ? `winner ${winner}${candidates ? `, ${candidates}` : ""}` : candidates;
  }
  if (path.startsWith("rehearsal.") && isRecord(value)) {
    const verdict = isRecord(value.verdict) ? value.verdict : null;
    if (verdict && typeof verdict.passed === "boolean") {
      return verdict.passed ? "rehearsal passed" : "rehearsal failed";
    }
  }
  return "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
