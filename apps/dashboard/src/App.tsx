import { useState } from "react";
import { sectionById, type SectionId } from "~/navigation/sections";
import { OnboardingSection } from "~/onboarding/OnboardingSection";
import { sampleRuns } from "~/runs/sampleRun";
import { RunsSection } from "~/runs/RunsSection";
import { StatusBadge } from "~/ui/StatusBadge";
import { AppShell } from "~/shell/AppShell";
import { SectionPlaceholder } from "~/shell/SectionPlaceholder";

export function App() {
  const [section, setSection] = useState<SectionId>("start");
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const activeSection = sectionById(section);

  return (
    <AppShell
      activeSection={section}
      onSelectSection={setSection}
      title={activeSection.label}
      headerBadge={section === "start" ? undefined : <StatusBadge label="Sample data" tone="neutral" />}
    >
      {section === "start" ? (
        <OnboardingSection
          onFollowRun={(id) => {
            setSelectedRunId(id);
            setSection("runs");
          }}
        />
      ) : section === "runs" ? (
        <RunsSection runs={sampleRuns} selectedRunId={selectedRunId} onSelectRun={setSelectedRunId} />
      ) : (
        <SectionPlaceholder section={activeSection} />
      )}
    </AppShell>
  );
}
