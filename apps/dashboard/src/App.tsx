import { sectionById } from "~/navigation/sections";
import { useHashRoute } from "~/navigation/useHashRoute";
import { runSource } from "~/runs/runSource";
import { RunsSection } from "~/runs/RunsSection";
import { StatusBadge } from "~/ui/StatusBadge";
import { AppShell } from "~/shell/AppShell";
import { SectionPlaceholder } from "~/shell/SectionPlaceholder";

export function App() {
  const route = useHashRoute();
  const activeSection = sectionById(route.section);

  return (
    <AppShell
      activeSection={route.section}
      onSelectSection={route.selectSection}
      title={activeSection.label}
      headerBadge={
        <StatusBadge
          label={runSource.mode === "live" ? "Live" : "Sample data"}
          tone={runSource.mode === "live" ? "running" : "neutral"}
        />
      }
    >
      {route.section === "runs" ? (
        <RunsSection
          source={runSource}
          runId={route.runId}
          onOpenRun={route.openRun}
          onCloseRun={route.closeRun}
        />
      ) : (
        <SectionPlaceholder section={activeSection} />
      )}
    </AppShell>
  );
}
