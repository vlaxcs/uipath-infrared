export type AnalysisOption = {
  id: string;
  title: string;
  category?: string;
  risk?: string;
};

export function analysisOptions(value: unknown): AnalysisOption[] {
  if (!isRecord(value) || !Array.isArray(value.findings)) return [];

  const seen = new Set<string>();
  const options: AnalysisOption[] = [];

  for (const finding of value.findings) {
    if (!isRecord(finding) || typeof finding.id !== "string") continue;
    const id = finding.id.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const option: AnalysisOption = {
      id,
      title: typeof finding.title === "string" && finding.title.trim() ? finding.title : id,
    };
    if (typeof finding.category === "string" && finding.category) option.category = finding.category;
    if (typeof finding.risk === "string" && finding.risk) option.risk = finding.risk;
    options.push(option);
  }

  return options;
}

export function evidenceText(evidence: string | string[] | undefined): string | null {
  if (Array.isArray(evidence)) {
    const parts = evidence.filter((item) => typeof item === "string" && item.length > 0);
    return parts.length > 0 ? parts.join(" ") : null;
  }
  return typeof evidence === "string" && evidence ? evidence : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
