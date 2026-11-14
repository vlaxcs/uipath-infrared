import { sampleArtifactInfos, sampleArtifactText } from "~/runs/sampleArtifacts";
import { sampleRun } from "~/runs/sampleRun";
import { RunSourceError, type RunSource } from "~/runs/source";

export const sampleRunSource: RunSource = {
  mode: "sample",
  listRuns: async () => [sampleRun],
  getRun: async (id) => {
    if (id === sampleRun.id) return sampleRun;
    throw new RunSourceError(`run ${id} not found`, 404);
  },
  startRun: async () => {
    throw new RunSourceError("Live runs need VITE_ORCHESTRATOR_URL");
  },
  eventsAfter: async () => [],
  submitDecision: async () => {
    throw new RunSourceError("Sample data is read-only");
  },
  listFiles: async () => sampleArtifactInfos(),
  readArtifact: async (_id, path) => sampleArtifactText(path),
  readLog: async () => ({ text: "", next: 0, running: false }),
};
