import { CandidatesSection } from "~/candidates/CandidatesSection";
import type { ResultDocument } from "~/candidates/types";
import { GraphSection } from "~/graph/GraphSection";
import { buildGraphModel } from "~/graph/model";
import type { InfraContract } from "~/graph/types";
import { sectionById } from "~/navigation/sections";
import { useHashRoute } from "~/navigation/useHashRoute";
import { OnboardingSection } from "~/onboarding/OnboardingSection";
import { RehearsalSection } from "~/rehearsal/RehearsalSection";
import type { RehearsalDocument } from "~/rehearsal/types";
import { RunDataSection } from "~/rundata/RunDataSection";
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
        <RunDataSection
          key="graph" source={source} runId={route.runId} onPickRun={route.pickRun} contract="infra" noun="infrastructure graph"
          render={(infra) => <GraphSection model={buildGraphModel(infra as InfraContract)} />}
        />
      ) : route.section === "rehearsal" ? (
        <RunDataSection
          key="rehearsal" source={source} runId={route.runId} onPickRun={route.pickRun} contract="rehearsal" noun="rehearsal"
          render={(rehearsal) => <RehearsalSection rehearsal={rehearsal as RehearsalDocument} />}
        />
      ) : route.section === "candidates" ? (
        <RunDataSection
          key="candidates" source={source} runId={route.runId} onPickRun={route.pickRun} contract="result" noun="result"
          render={(result) => <CandidatesSection result={result as ResultDocument} />}
        />
      ) : (
        <SectionPlaceholder section={activeSection} />
      )}
    </AppShell>
  );
}
