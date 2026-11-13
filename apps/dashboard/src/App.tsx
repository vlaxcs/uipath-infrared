import { useState } from "react";
import { CandidatesSection } from "~/candidates/CandidatesSection";
import { sampleResult } from "~/candidates/sampleResult";
import { sectionById, type SectionId } from "~/navigation/sections";
import { sampleRuns } from "~/runs/sampleRun";
import { RunsSection } from "~/runs/RunsSection";
import { StatusBadge } from "~/ui/StatusBadge";
import { AppShell } from "~/shell/AppShell";
import { SectionPlaceholder } from "~/shell/SectionPlaceholder";

export function App() {
  const [section, setSection] = useState<SectionId>("runs");
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const activeSection = sectionById(section);

  return (
    <AppShell
      activeSection={section}
      onSelectSection={setSection}
      title={activeSection.label}
      headerBadge={<StatusBadge label="Sample data" tone="neutral" />}
    >
      {section === "runs" ? (
        <RunsSection runs={sampleRuns} selectedRunId={selectedRunId} onSelectRun={setSelectedRunId} />
      ) : section === "candidates" ? (
        <CandidatesSection result={sampleResult} />
      ) : (
        <SectionPlaceholder section={activeSection} />
      )}
    </AppShell>
  );
}
