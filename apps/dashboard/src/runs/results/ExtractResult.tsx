import type { InfraArtifact } from "~/runs/artifactTypes";
import { formatEUR } from "~/runs/format";
import { Field, Section, Table } from "~/runs/results/ResultParts";

export function ExtractResult({ value }: { value: InfraArtifact }) {
  const components = value.components ?? [];
  const edges = value.edges ?? [];
  const monthly = components.reduce(
    (sum, component) => sum + (component.cost?.monthly_eur?.value ?? 0),
    0,
  );

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid gap-3 sm:grid-cols-3">
        <Field label="Project">{value.project ?? "Unknown"}</Field>
        <Field label="Extractor">{value.source?.extractor ?? "Unknown"}</Field>
        <Field label="Monthly cost">{formatEUR(monthly)}</Field>
        <Field label="Components">{components.length}</Field>
        <Field label="Dependencies">{edges.length}</Field>
        <Field label="Stacks">{value.stacks?.length ?? 0}</Field>
      </dl>
      <Section title="Components">
        <Table
          headers={["Component", "Kind", "Region", "Status"]}
          rows={components.slice(0, 12).map((component) => [
            component.id ?? "—",
            component.kind ?? "—",
            component.region ?? "—",
            component.status ?? "—",
          ])}
        />
        {components.length > 12 ? (
          <p className="text-caption text-fg-subtle">+{components.length - 12} more in the raw JSON.</p>
        ) : null}
      </Section>
    </div>
  );
}
