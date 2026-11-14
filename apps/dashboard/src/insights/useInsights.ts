import { useEffect, useState } from "react";
import { deriveRun, groupProjects, latestArtifactPaths } from "~/insights/derive";
import type { InsightReader, ProjectInsight, RunArtifacts, RunInsight } from "~/insights/types";

const REFRESH_MS = 4000;

export type InsightsState =
  | { status: "loading" }
  | { status: "ready"; projects: ProjectInsight[]; stale: boolean }
  | { status: "error"; message: string };

export function useInsights(reader: InsightReader): InsightsState {
  const [state, setState] = useState<InsightsState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    const cache = new Map<string, { updated: string; insight: RunInsight }>();
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function load() {
      try {
        const summaries = await reader.listRuns(controller.signal);
        // One run that cannot be read keeps its last known state, or is left out; it never blanks the page.
        const settled = await Promise.allSettled(
          summaries.map(async (summary) => {
            const cached = cache.get(summary.id);
            if (cached && cached.updated === summary.updated_at) return cached.insight;
            const [run, artifacts] = await Promise.all([
              reader.getRun(summary.id, controller.signal),
              readArtifacts(reader, summary.id, controller.signal),
            ]);
            const insight = deriveRun(run, artifacts);
            cache.set(summary.id, { updated: summary.updated_at, insight });
            return insight;
          }),
        );
        if (controller.signal.aborted) return;
        const insights = settled.flatMap((outcome, index) => {
          if (outcome.status === "fulfilled") return [outcome.value];
          const cached = cache.get(summaries[index]!.id);
          return cached ? [cached.insight] : [];
        });
        setState({ status: "ready", projects: groupProjects(insights), stale: settled.some((outcome) => outcome.status === "rejected") });
      } catch (error) {
        if (controller.signal.aborted) return;
        setState((current) =>
          current.status === "ready"
            ? { ...current, stale: true }
            : { status: "error", message: error instanceof Error ? error.message : "unreachable" },
        );
      }
      if (reader.mode === "live" && !controller.signal.aborted) timer = setTimeout(load, REFRESH_MS);
    }

    void load();
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [reader]);

  return state;
}

async function readArtifacts(reader: InsightReader, id: string, signal: AbortSignal): Promise<RunArtifacts> {
  const files = await reader.listFiles(id, signal).catch(() => []);
  const paths = files.map((file) => file.path);
  const latest = latestArtifactPaths(paths);
  const want: [keyof RunArtifacts, string | null][] = [
    ["infra", paths.includes("infra.json") ? "infra.json" : null],
    ["findings", paths.includes("findings.json") ? "findings.json" : null],
    ["result", latest.result],
    ["rehearsal", latest.rehearsal],
  ];
  const read = await Promise.all(
    want.map(async ([key, path]) => {
      if (!path) return [key, undefined] as const;
      try {
        return [key, JSON.parse(await reader.readArtifact(id, path, signal)) as unknown] as const;
      } catch {
        return [key, undefined] as const;
      }
    }),
  );
  return Object.fromEntries(read.filter(([, value]) => value !== undefined));
}
