import { useState } from "react";
import { sectionById, type SectionId } from "~/navigation/sections";
import { runSource } from "~/runs/runSource";
import { RunsSection } from "~/runs/RunsSection";
import { StatusBadge } from "~/ui/StatusBadge";
import { AppShell } from "~/shell/AppShell";
import { SectionPlaceholder } from "~/shell/SectionPlaceholder";

export function App() {
  const [section, setSection] = useState<SectionId>("runs");
  const activeSection = sectionById(section);

  return (
    <AppShell
      activeSection={section}
      onSelectSection={setSection}
      title={activeSection.label}
      headerBadge={
        <StatusBadge
          label={runSource.mode === "live" ? "Live" : "Sample data"}
          tone={runSource.mode === "live" ? "running" : "neutral"}
        />
      }
    >
      {section === "runs" ? <RunsSection source={runSource} /> : <SectionPlaceholder section={activeSection} />}
    </AppShell>
  );
}
