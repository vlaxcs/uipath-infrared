import { CandidatesSection } from "~/candidates/CandidatesSection";
import { sampleResult } from "~/candidates/sampleResult";
import { GraphSection } from "~/graph/GraphSection";
import { sampleGraphModel } from "~/graph/sampleGraph";
import { sectionById } from "~/navigation/sections";
import { useHashRoute } from "~/navigation/useHashRoute";
import { OnboardingSection } from "~/onboarding/OnboardingSection";
import { RehearsalSection } from "~/rehearsal/RehearsalSection";
import { sampleRehearsal } from "~/rehearsal/sampleRehearsal";
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
        route.section === "start" ? undefined : (
          <StatusBadge
            label={source.mode === "live" ? "Live" : "Sample data"}
            tone={source.mode === "live" ? "running" : "neutral"}
          />
        )
      }
    >
      {route.section === "start" ? (
        <OnboardingSection onFollowRun={route.openRun} />
      ) : route.section === "runs" ? (
        <RunsSection
          source={source}
          runId={route.runId}
          focusGate={route.focusGate}
          onOpenRun={route.openRun}
          onCloseRun={route.focusGate ? route.closeGate : route.closeRun}
        />
      ) : route.section === "approvals" ? (
        <ApprovalsPage source={source} onReview={route.openGate} />
      ) : route.section === "graph" ? (
        <GraphSection model={sampleGraphModel} />
      ) : route.section === "rehearsal" ? (
        <RehearsalSection rehearsal={sampleRehearsal} />
      ) : route.section === "candidates" ? (
        <CandidatesSection result={sampleResult} />
      ) : (
        <SectionPlaceholder section={activeSection} />
      )}
    </AppShell>
  );
}
