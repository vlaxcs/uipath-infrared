import type { RunSource } from "~/runs/source";
import { RunPage } from "~/runs/RunPage";
import { RunsPage } from "~/runs/RunsPage";

type RunsSectionProps = {
  source: RunSource;
  runId: string | null;
  focusGate: boolean;
  onOpenRun: (id: string) => void;
  onCloseRun: () => void;
};

export function RunsSection({ source, runId, focusGate, onOpenRun, onCloseRun }: RunsSectionProps) {
  if (runId) {
    return (
      <RunPage
        source={source}
        runId={runId}
        focusGate={focusGate}
        onBack={onCloseRun}
        onOpenRun={onOpenRun}
      />
    );
  }
  return <RunsPage source={source} onOpenRun={onOpenRun} />;
}
