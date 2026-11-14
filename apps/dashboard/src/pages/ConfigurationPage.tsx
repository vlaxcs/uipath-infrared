import { Fact, PageHeader, PageSection } from "~/pages/PageSection";

const CRITERIA = ["High availability", "Cost reduction", "Data residency", "Performance"];

export function ConfigurationPage() {
  return (
    <section aria-labelledby="configuration-title" className="mx-auto flex max-w-3xl flex-col gap-4">
      <PageHeader id="configuration-title" title="Configuration" lead="Connections and the defaults every new analysis starts from." />
      <PageSection title="GitHub organisation">
        <dl className="flex flex-col gap-1">
          <Fact label="Organisation" value="Not connected" />
        </dl>
        <p className="text-caption text-fg-subtle">Connected with GitHub sign-in.</p>
      </PageSection>
      <PageSection title="Infrastructure">
        <dl className="flex flex-col gap-1">
          <Fact label="Provider" value="AWS" />
          <Fact label="Account" value="Demo estate on Floci" />
        </dl>
        <p className="text-caption text-fg-subtle">Reached with the orchestrator&apos;s credentials. No cloud credentials pass through the browser.</p>
      </PageSection>
      <PageSection title="Project defaults">
        <dl className="flex flex-col gap-1">
          {CRITERIA.map((criterion) => (
            <Fact key={criterion} label={criterion} value="Project forecast" />
          ))}
        </dl>
        <p className="text-caption text-fg-subtle">Until defaults are saved here, each analysis uses its project&apos;s forecast.json.</p>
      </PageSection>
      <PageSection title="On-prem">
        <dl className="flex flex-col gap-1">
          <Fact label="Site" value="Not set" />
        </dl>
      </PageSection>
    </section>
  );
}
