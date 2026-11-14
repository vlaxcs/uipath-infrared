import type { InsightReader } from "~/insights/types";
import { RunSourceError } from "~/runs/source";
import type { RunDetail } from "~/runs/types";

type SampleEntry = { run: RunDetail; files: Record<string, unknown> };

// Eleven runs of the four mock projects through the real orchestrator and engine, captured once.
// Loaded on first use, so a live dashboard never downloads it.
let loading: Promise<SampleEntry[]> | null = null;

function entries(): Promise<SampleEntry[]> {
  loading ??= import("~/insights/sample/runs.json").then((module) => module.default as unknown as SampleEntry[]);
  return loading;
}

async function entry(id: string): Promise<SampleEntry> {
  const found = (await entries()).find((item) => item.run.id === id);
  if (!found) throw new RunSourceError(`run ${id} not found`, 404);
  return found;
}

export const sampleInsightSource: InsightReader = {
  mode: "sample",
  listRuns: async () => (await entries()).map(({ run }) => run),
  getRun: async (id) => (await entry(id)).run,
  listFiles: async (id) =>
    Object.entries((await entry(id)).files).map(([path, value]) => ({ path, size: JSON.stringify(value).length })),
  readArtifact: async (id, path) => {
    const value = (await entry(id)).files[path];
    if (value === undefined) throw new RunSourceError(`artifact ${path} not found`, 404);
    return JSON.stringify(value);
  },
};
