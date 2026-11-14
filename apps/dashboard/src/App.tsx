import { sectionById } from "~/navigation/sections";
import { useHashRoute } from "~/navigation/useHashRoute";
import { ApprovalsPage } from "~/runs/ApprovalsPage";
import { runSource } from "~/runs/runSource";
import { RunsSection } from "~/runs/RunsSection";
import type { RunSource } from "~/runs/source";
import { StatusBadge } from "~/ui/StatusBadge";
import { AppShell } from "~/shell/AppShell";
import { SectionPlaceholder } from "~/shell/SectionPlaceholder";

type AppProps = {
  source?: RunSource;
};

export function App({ source = runSource }: AppProps = {}) {
  const route = useHashRoute();
  const activeSection = sectionById(route.section);

  return (
    <AppShell
      activeSection={route.section}
      onSelectSection={route.selectSection}
      title={activeSection.label}
      headerBadge={
        <StatusBadge
          label={source.mode === "live" ? "Live" : "Sample data"}
          tone={source.mode === "live" ? "running" : "neutral"}
        />
      }
    >
      {route.section === "runs" ? (
        <RunsSection
          source={source}
          runId={route.runId}
          focusGate={route.focusGate}
          onOpenRun={route.openRun}
          onCloseRun={route.focusGate ? route.closeGate : route.closeRun}
        />
      ) : route.section === "approvals" ? (
        <ApprovalsPage source={source} onReview={route.openGate} />
      ) : (
        <SectionPlaceholder section={activeSection} />
      )}
    </AppShell>
  );
}
