import { useState } from "react";
import { sectionById, type SectionId } from "~/navigation/sections";
import { sampleRuns } from "~/runs/sampleRun";
import { sampleRunSource } from "~/runs/sampleRunSource";
import { RunsSection } from "~/runs/RunsSection";
import { StatusBadge } from "~/ui/StatusBadge";
import { AppShell } from "~/shell/AppShell";
import { SectionPlaceholder } from "~/shell/SectionPlaceholder";

export function App() {
  const [section, setSection] = useState<SectionId>("runs");
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const activeSection = sectionById(section);
  const selectedRun = sampleRuns.find((run) => run.id === selectedRunId) ?? null;

  return (
    <AppShell
      activeSection={section}
      onSelectSection={setSection}
      title={activeSection.label}
      headerBadge={<StatusBadge label="Sample data" tone="neutral" />}
    >
      {section === "runs" ? (
        <RunsSection
          runs={sampleRuns}
          selectedRun={selectedRun}
          selectedRunId={selectedRunId}
          onSelectRun={setSelectedRunId}
          source={sampleRunSource}
        />
      ) : (
        <SectionPlaceholder section={activeSection} />
      )}
    </AppShell>
  );
}
